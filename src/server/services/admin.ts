import { usernameSchema } from "@/server/validators";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/permissions";
import { ensure } from "@/server/errors";
import type { Actor } from "@/types/domain";
import { terminalStatuses } from "@/types/domain";
import { actorSelect } from "@/server/repositories/tickets";
import { hashPassword } from "@/server/auth/password";
import {
  routingSchema,
  routingPatchSchema,
  userSchema,
  userPatchSchema,
} from "@/server/validators";
export async function saveRule(
  actor: Actor,
  input: z.infer<typeof routingSchema> | z.infer<typeof routingPatchSchema>,
  id?: string,
) {
  requireAdmin(actor);
  return prisma.$transaction(async (db) => {
    const old = id ? await db.routingRule.findUnique({ where: { id } }) : null;
    ensure(!id || old, 404, "NOT_FOUND", "Правило не найдено");
    const data = routingSchema.parse({
      ...(old
        ? {
            categoryId: old.categoryId,
            departmentId: old.departmentId,
            assigneeId: old.assigneeId,
            isActive: old.isActive,
          }
        : {}),
      ...input,
    });
    const assignee = await db.user.findFirst({
      where: {
        id: data.assigneeId,
        role: { in: ["MANAGER", "ADMIN"] },
        ...(data.isActive
          ? { isActive: true, department: { isActive: true } }
          : {}),
      },
    });
    const category = await db.category.findFirst({
      where: {
        id: data.categoryId,
        ...(data.isActive ? { isActive: true } : {}),
      },
    });
    const department = data.departmentId
      ? await db.department.findFirst({
          where: {
            id: data.departmentId,
            ...(data.isActive ? { isActive: true } : {}),
          },
        })
      : true;

    ensure(
      assignee && category && department,
      422,
      "INVALID_ROUTING",
      "Нужны действующие категория, подразделение и ответственный",
    );
    return id
      ? db.routingRule.update({ where: { id }, data })
      : db.routingRule.create({ data });
  });
}
export async function createUser(
  actor: Actor,
  input: z.infer<typeof userSchema>,
) {
  requireAdmin(actor);
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, isActive: true },
  });
  ensure(
    department,
    422,
    "INVALID_DEPARTMENT",
    "Подразделение не найдено или отключено",
  );
  const { password, ...data } = input;
  return prisma.user.create({
    data: { ...data, username: input.username ?? usernameSchema.parse(input.email!.split("@")[0]), passwordHash: await hashPassword(password) },
    select: actorSelect,
  });
}
export async function updateUser(
  actor: Actor,
  id: string,
  input: z.infer<typeof userPatchSchema>,
) {
  requireAdmin(actor);
  ensure(
    id !== actor.id,
    403,
    "SELF_ADMIN_CHANGE",
    "Собственные административные права меняет другой администратор",
  );
  const { password, ...data } = input;
  const passwordHash = password ? await hashPassword(password) : undefined;
  return prisma.$transaction(async (db) => {
    const user = await db.user.findUnique({ where: { id } });
    ensure(user, 404, "NOT_FOUND", "Пользователь не найден");
    if (input.departmentId)
      ensure(
        await db.department.findFirst({
          where: { id: input.departmentId, isActive: true },
        }),
        422,
        "INVALID_DEPARTMENT",
        "Нужно действующее подразделение",
      );
    if (
      input.isActive === false ||
      input.role === "EMPLOYEE" ||
      (input.departmentId && input.departmentId !== user.departmentId)
    ) {
      const assigned = await db.ticket.count({
        where: { assigneeId: id, status: { notIn: terminalStatuses } },
      });
      ensure(
        assigned === 0,
        409,
        "HAS_ACTIVE_TICKETS",
        "Сначала переназначьте незавершённые обращения пользователя",
      );
    }
    const updated = await db.user.update({
      where: { id },
      data: { ...data, ...(passwordHash ? { passwordHash } : {}) },
      select: actorSelect,
    });
    await db.session.deleteMany({ where: { userId: id } });
    return updated;
  });
}
