import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/types/domain";
import { terminalStatuses } from "@/types/domain";
import { ensure, AppError } from "@/server/errors";
import { canManage } from "@/server/permissions";
import { getTicket } from "./tickets";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const storageDir = resolve(
  /* turbopackIgnore: true */ process.env.ATTACHMENT_STORAGE_DIR ??
    ".storage/attachments",
);
const metaSelect = {
  id: true,
  ticketId: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;
function privatePath(key: string) {
  ensure(
    /^[a-f0-9-]{36}$/.test(key),
    500,
    "INVALID_STORAGE_KEY",
    "Файл недоступен",
  );
  const path = resolve(storageDir, key);
  ensure(
    path.startsWith(storageDir + sep),
    500,
    "INVALID_STORAGE_KEY",
    "Файл недоступен",
  );
  return path;
}
function officeKind(buffer: Buffer) {
  // Inspect the central directory without inflating or executing archive contents.
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) return null;
  const entries = buffer.readUInt16LE(end + 10),
    offset = buffer.readUInt32LE(end + 16),
    size = buffer.readUInt32LE(end + 12);
  if (
    entries > 2000 ||
    entries === 0 ||
    offset + size > end ||
    buffer.readUInt16LE(end + 4) !== 0 ||
    buffer.readUInt16LE(end + 6) !== 0
  )
    return null;
  const names = new Set<string>();
  let cursor = offset,
    expanded = 0;
  for (let i = 0; i < entries; i++) {
    if (
      cursor + 46 > end ||
      buffer.readUInt32LE(cursor) !== 0x02014b50 ||
      buffer.readUInt16LE(cursor + 8) & 1
    )
      return null;
    const nameLength = buffer.readUInt16LE(cursor + 28),
      extra = buffer.readUInt16LE(cursor + 30),
      comment = buffer.readUInt16LE(cursor + 32),
      localOffset = buffer.readUInt32LE(cursor + 42);
    if (
      cursor + 46 + nameLength + extra + comment > end ||
      localOffset + 30 > offset ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50
    )
      return null;
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (
      name.includes("..") ||
      name.includes("\\") ||
      name.startsWith("/") ||
      /vbaproject|activex|embeddings\//i.test(name)
    )
      return null;
    names.add(name);
    expanded += buffer.readUInt32LE(cursor + 24);
    if (expanded > 50 * 1024 * 1024) return null;
    cursor += 46 + nameLength + extra + comment;
  }
  if (!names.has("[Content_Types].xml")) return null;
  if (names.has("word/document.xml")) return "docx";
  if (names.has("xl/workbook.xml")) return "xlsx";
  return null;
}
export function inspectFile(
  filename: string,
  buffer: Buffer,
  claimedType: string,
) {
  ensure(
    buffer.length > 0 && buffer.length <= MAX_FILE_BYTES,
    413,
    "FILE_TOO_LARGE",
    "Файл должен быть непустым и не больше 10 МБ",
  );
  const extension = extname(filename).toLowerCase().slice(1);
  let kind: string | null = null;
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") kind = "pdf";
  else if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    kind = "png";
  else if (
    buffer.length >= 3 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  )
    kind = "jpg";
  else if (buffer.length >= 22 && buffer.readUInt32LE(0) === 0x04034b50)
    kind = officeKind(buffer);
  ensure(
    kind && (kind === extension || (kind === "jpg" && extension === "jpeg")),
    422,
    "INVALID_FILE_TYPE",
    "Разрешены PDF, DOCX, XLSX, JPG и PNG с соответствующим содержимым",
  );
  const mime = (
    {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as Record<string, string>
  )[kind];
  ensure(
    !claimedType ||
      claimedType === mime ||
      claimedType === "application/octet-stream",
    422,
    "INVALID_FILE_TYPE",
    "Тип файла не соответствует содержимому",
  );
  return mime;
}
async function multipart(req: NextRequest) {
  ensure(
    req.headers.get("content-type")?.startsWith("multipart/form-data;"),
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Ожидается multipart/form-data",
  );
  const limit = MAX_FILE_BYTES + 65536;
  ensure(
    Number(req.headers.get("content-length") ?? 0) <= limit,
    413,
    "FILE_TOO_LARGE",
    "Файл больше 10 МБ",
  );
  const reader = req.body?.getReader();
  ensure(reader, 400, "INVALID_MULTIPART", "Тело запроса отсутствует");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new AppError(413, "FILE_TOO_LARGE", "Файл больше 10 МБ");
    }
    chunks.push(value);
  }
  try {
    return await new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": req.headers.get("content-type")! },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new AppError(400, "INVALID_MULTIPART", "Некорректная форма загрузки");
  }
}
export async function uploadAttachment(
  actor: Actor,
  id: string,
  req: NextRequest,
) {
  const ticket = await getTicket(actor, id);
  ensure(
    actor.id === ticket.authorId || canManage(actor, ticket),
    403,
    "FORBIDDEN",
    "Нет права загружать файл",
  );
  const form = await multipart(req);
  ensure(
    [...form.keys()].every((key) => key === "file" || key === "version") &&
      form.getAll("file").length === 1 &&
      form.getAll("version").length === 1,
    422,
    "VALIDATION_ERROR",
    "Передайте один file и version",
  );
  const version = z.coerce.number().int().positive().parse(form.get("version"));
  const file = form.get("file");
  ensure(file instanceof File, 422, "VALIDATION_ERROR", "Файл не выбран");
  const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").trim();
  ensure(
    filename.length > 0 && filename.length <= 180,
    422,
    "VALIDATION_ERROR",
    "Слишком длинное имя файла",
  );
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = inspectFile(filename, bytes, file.type);
  const storageKey = randomUUID(),
    path = privatePath(storageKey);
  await mkdir(storageDir, { recursive: true });
  await writeFile(path, bytes, { flag: "wx" });
  try {
    return await prisma.$transaction(async (db) => {
      const current = await getTicket(actor, id, db);
      ensure(
        !current.archivedAt && !terminalStatuses.includes(current.status),
        409,
        "COMPLETED",
        "Загрузка доступна только в открытое обращение",
      );
      ensure(
        actor.id === current.authorId || canManage(actor, current),
        403,
        "FORBIDDEN",
        "Нет права загружать файл",
      );
      const updated = await db.ticket.updateMany({
        where: { id, version },
        data: { version: { increment: 1 } },
      });
      ensure(
        updated.count === 1,
        409,
        "VERSION_CONFLICT",
        "Обращение изменилось. Обновите данные",
      );
      ensure(
        (await db.attachment.count({ where: { ticketId: id } })) < 10,
        422,
        "ATTACHMENT_LIMIT",
        "Не больше 10 файлов на обращение",
      );
      const attachment = await db.attachment.create({
        data: {
          ticketId: id,
          filename,
          storageKey,
          mimeType,
          size: bytes.length,
        },
        select: metaSelect,
      });
      await db.ticketHistory.create({
        data: {
          ticketId: id,
          actorId: actor.id,
          action: "ATTACHMENT_ADDED",
          newValue: {
            attachmentId: attachment.id,
            filename,
            size: bytes.length,
          },
        },
      });
      return { attachment, ticket: await getTicket(actor, id, db) };
    });
  } catch (error) {
    await unlink(path).catch(() => {});
    throw error;
  }
}
export async function listAttachments(actor: Actor, id: string) {
  await getTicket(actor, id);
  return {
    items: await prisma.attachment.findMany({
      where: { ticketId: id },
      select: metaSelect,
      orderBy: { createdAt: "asc" },
    }),
  };
}
export async function downloadAttachment(
  actor: Actor,
  id: string,
  attachmentId: string,
) {
  await getTicket(actor, id);
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId: id },
  });
  ensure(attachment, 404, "NOT_FOUND", "Вложение не найдено");
  let bytes: Buffer;
  try {
    bytes = await readFile(
      /* turbopackIgnore: true */ privatePath(attachment.storageKey),
    );
  } catch {
    throw new AppError(503, "STORAGE_UNAVAILABLE", "Файл временно недоступен");
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(attachment.filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
