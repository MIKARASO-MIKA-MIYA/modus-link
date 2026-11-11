import type { Prisma } from "@/generated/prisma/client";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensure } from "@/server/errors";
import { actorSelect } from "@/server/repositories/tickets";
import { verifyPassword } from "./password";
import { normalizeUsername } from "@/lib/usernames";
export const cookieName = "modus_session";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function cookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
  };
}
export async function currentActor(req: NextRequest) {
  const token = req.cookies.get(cookieName)?.value;
  ensure(
    token && /^[a-f0-9]{64}$/.test(token),
    401,
    "UNAUTHENTICATED",
    "Войдите в систему",
  );
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      user: {
        select: {
          ...actorSelect,
          isActive: true,
          department: { select: { isActive: true } },
        },
      },
    },
  });
  ensure(
    session &&
      session.expiresAt > new Date() &&
      session.user.isActive &&
      session.user.department.isActive,
    401,
    "UNAUTHENTICATED",
    "Сессия истекла или пользователь отключён",
  );
  const { id, name, username, email, role, departmentId, canViewCompanyAnalytics } =
    session.user;
  return { id, name, username, email, role, departmentId, canViewCompanyAnalytics };
}
export async function limitAuthAttempts(identifier: string) {
 const now = new Date(), key = tokenHash(identifier);
 await prisma.$executeRaw`INSERT INTO "LoginThrottle" (key, attempts, "windowStart") VALUES (${key}, 1, ${now}) ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN "LoginThrottle"."windowStart" < ${new Date(now.getTime() - 900000)} THEN 1 ELSE "LoginThrottle".attempts + 1 END, "windowStart" = CASE WHEN "LoginThrottle"."windowStart" < ${new Date(now.getTime() - 900000)} THEN ${now} ELSE "LoginThrottle"."windowStart" END`;
 const throttle = await prisma.loginThrottle.findUniqueOrThrow({ where: { key } });
 ensure(throttle.attempts <= 15, 429, "RATE_LIMITED", "Слишком много попыток. Повторите через 15 минут");
}
export async function createSession(db: Prisma.TransactionClient, userId: string, previousToken?: string) {
 const token = randomBytes(32).toString("hex");
 const hours = Number(process.env.SESSION_TTL_HOURS ?? 12);
 const expiresAt = new Date(Date.now() + (Number.isFinite(hours) && hours > 0 && hours <= 168 ? hours : 12) * 3600000);
 if (previousToken) await db.session.deleteMany({ where: { tokenHash: tokenHash(previousToken) } });
 await db.session.create({ data: { tokenHash: tokenHash(token), userId, expiresAt } });
 const actor = await db.user.findUniqueOrThrow({ where: { id: userId }, select: actorSelect });
 return { token, expiresAt, actor };
}
export async function login(identifier: string, password: string, previousToken?: string) {
 const normalized = normalizeUsername(identifier);
 await limitAuthAttempts(`login:${normalized}`);
 const user = await prisma.user.findUnique({ where: normalized.includes("@") ? { email: normalized } : { username: normalized }, include: { department: true } });
 const dummy = `scrypt$00000000000000000000000000000000$${"00".repeat(64)}`;
 const valid = await verifyPassword(password, user?.passwordHash ?? dummy);
 ensure(valid && user?.isActive && user.department.isActive, 401, "INVALID_CREDENTIALS", "Неверный ник или пароль");
 return prisma.$transaction(db => createSession(db, user.id, previousToken));
}
