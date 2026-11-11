import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/types/domain";
import { currentActor } from "@/server/auth/session";
import { AppError, ensure } from "@/server/errors";
export function ok(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function assertOrigin(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const expected = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000")
    .origin;
  ensure(
    request.headers.get("origin") === expected,
    403,
    "INVALID_ORIGIN",
    "Требуется разрешённый Origin",
  );
}
async function execute(
  request: NextRequest,
  action: () => Promise<NextResponse>,
) {
  const requestId = randomUUID();
  try {
    assertOrigin(request);
    const res = await action();
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (error) {
    let e: AppError;
    if (error instanceof AppError) e = error;
    else if (error instanceof z.ZodError)
      e = new AppError(
        422,
        "VALIDATION_ERROR",
        "Проверьте поля запроса",
        error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      );
    else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      e = new AppError(
        409,
        "CONFLICT",
        "Запись с такими данными уже существует",
      );
    else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    )
      e = new AppError(422, "INVALID_REFERENCE", "Связанная запись недоступна");
    else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      e = new AppError(
        409,
        "CONFLICT",
        "Параллельное изменение. Повторите запрос",
      );
    else {
      console.error(
        "Request failed",
        requestId,
        error instanceof Error ? error.message : "Unknown error",
      );
      e = new AppError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера");
    }
    return NextResponse.json(
      {
        error: {
          code: e.code,
          message: e.message,
          ...(e.details ? { details: e.details } : {}),
          requestId,
        },
      },
      {
        status: e.status,
        headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
      },
    );
  }
}
export const route = (
  req: NextRequest,
  action: (actor: Actor) => Promise<NextResponse>,
) => execute(req, async () => action(await currentActor(req)));
export const publicRoute = (
  req: NextRequest,
  action: () => Promise<NextResponse>,
) => execute(req, action);
export async function body(req: NextRequest): Promise<unknown> {
  ensure(
    req.headers.get("content-type")?.split(";")[0].trim() ===
      "application/json",
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Ожидается application/json",
  );
  const limit = 65536;
  ensure(
    Number(req.headers.get("content-length") ?? 0) <= limit,
    413,
    "PAYLOAD_TOO_LARGE",
    "Размер JSON превышает 64 KiB",
  );
  const reader = req.body?.getReader();
  ensure(reader, 400, "INVALID_JSON", "Ожидается JSON");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Размер JSON превышает 64 KiB",
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_JSON", "Некорректный JSON");
  }
}
export function query(req: NextRequest) {
  const entries = [...req.nextUrl.searchParams];
  ensure(
    new Set(entries.map(([key]) => key)).size === entries.length,
    422,
    "VALIDATION_ERROR",
    "Параметры запроса не должны повторяться",
  );
  return Object.fromEntries(entries);
}
