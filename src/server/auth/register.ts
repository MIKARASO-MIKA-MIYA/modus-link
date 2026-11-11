import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ensure } from "@/server/errors";
import { registerSchema } from "@/server/validators";
import { createSession, limitAuthAttempts } from "./session";
import { hashPassword } from "./password";
export async function registerAccount(input: { username: string; password: string }, previousToken?: string) {
 const { username, password } = registerSchema.parse(input);
 await limitAuthAttempts(`register:${username}`);
 if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) throw new AppError(409, "USERNAME_TAKEN", "Этот ник уже занят. Придумайте другой");
 const passwordHash = await hashPassword(password);
 try {
  return await prisma.$transaction(async db => {
   const department = await db.department.upsert({ where: { name: "Новые сотрудники" }, update: {}, create: { name: "Новые сотрудники" } });
   ensure(department.isActive, 503, "REGISTRATION_UNAVAILABLE", "Регистрация временно недоступна. Обратитесь к администратору");
   const user = await db.user.create({ data: { username, name: username, passwordHash, departmentId: department.id, email: null, role: "EMPLOYEE", canViewCompanyAnalytics: false } });
   return createSession(db, user.id, previousToken);
  });
 } catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "USERNAME_TAKEN", "Этот ник уже занят. Придумайте другой");
  throw error;
 }
}