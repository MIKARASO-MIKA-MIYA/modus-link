import { createHash } from "node:crypto";
import {
  PrismaClient,
  type TicketStatus,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import source from "./data/tickets.json";
export function seedId(key: string) {
  const s = createHash("sha256").update(`modus-demo:${key}`).digest("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-5${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}
const departments: Record<string, string> = {
  "Сотрудник закупок": "Закупки",
  "Сотрудник проектирования": "Проектирование",
  "Сотрудник бухгалтерии": "Бухгалтерия",
  "Менеджер по продажам": "Продажи",
  "Координатор проекта": "Проекты",
  "Руководитель проекта": "Проекты",
  "Сотрудник офиса": "Офис",
  "Руководитель закупок": "Закупки",
  "Руководитель бухгалтерии": "Бухгалтерия",
  "Руководитель продаж": "Продажи",
  "Руководитель проектирования": "Проектирование",
  "Руководитель проектов": "Проекты",
  "IT-специалист": "IT",
  "Руководитель подразделения": "Бухгалтерия",
};
const typeMap = {
  Проблема: "PROBLEM",
  Предложение: "SUGGESTION",
  "Положительный отзыв": "POSITIVE_FEEDBACK",
} as const;
const priorityMap = {
  Низкий: "LOW",
  Средний: "MEDIUM",
  Высокий: "HIGH",
} as const;
const statusMap = {
  Новое: "NEW",
  "На рассмотрении": "UNDER_REVIEW",
  "В работе": "IN_PROGRESS",
  Реализовано: "IMPLEMENTED",
  "Ожидает уточнения": "NEEDS_CLARIFICATION",
  Отклонено: "REJECTED",
  Закрыто: "CLOSED",
} as const;
const paths: Record<TicketStatus, TicketStatus[]> = {
  NEW: [],
  UNDER_REVIEW: ["UNDER_REVIEW"],
  NEEDS_CLARIFICATION: ["UNDER_REVIEW", "NEEDS_CLARIFICATION"],
  IN_PROGRESS: ["UNDER_REVIEW", "IN_PROGRESS"],
  IMPLEMENTED: ["UNDER_REVIEW", "IN_PROGRESS", "IMPLEMENTED"],
  REJECTED: ["UNDER_REVIEW", "REJECTED"],
  CLOSED: ["UNDER_REVIEW", "CLOSED"],
};
export async function seedDemo(prisma: PrismaClient, password: string) {
  if (password.length < 12)
    throw new Error("DEMO_PASSWORD must have at least 12 characters");
  const hash = await hashPassword(password);
  await prisma.$transaction(
    async (db) => {
      const roles = [
        ...new Set(source.flatMap((r) => [r.authorRole, r.assigneeRole])),
      ];
      const departmentNames = [
        ...new Set([
          ...roles.map((r) => departments[r] ?? "Управление"),
          "Управление",
        ]),
      ];
      for (const name of departmentNames)
        await db.department.upsert({
          where: { name },
          update: {},
          create: { id: seedId(`dept:${name}`), name },
        });
      for (const name of roles) {
        const employee = source.some((t) => t.authorRole === name);
        const role =
          employee && name !== "Руководитель проекта" ? "EMPLOYEE" : "MANAGER";
        const email =
          name === "Сотрудник закупок"
            ? "employee@modus.local"
            : name === "Руководитель закупок"
              ? "manager@modus.local"
              : `demo-${seedId(name).slice(0, 8)}@modus.local`;
        const department = await db.department.findUniqueOrThrow({
          where: { name: departments[name] ?? "Управление" },
        });
        await db.user.upsert({
          where: { email },
          update: {},
          create: {
            id: seedId(`user:${name}`),
            name,
            email,
            username: email.split("@")[0],
            role,
            departmentId: department.id,
            passwordHash: hash,
          },
        });
      }
      for (const [email, name, role, canViewCompanyAnalytics] of [
        ["admin@modus.local", "Администратор демо", "ADMIN", true],
        ["owner@modus.local", "Собственник демо", "MANAGER", true],
      ] as const)
        await db.user.upsert({
          where: { email },
          update: {},
          create: {
            id: seedId(email),
            email,
            username: email.split("@")[0],
            name,
            role,
            canViewCompanyAnalytics,
            passwordHash: hash,
            departmentId: seedId("dept:Управление"),
          },
        });
      for (const r of source) {
        const category = await db.category.upsert({
          where: { name: r.category },
          update: {},
          create: {
            id: seedId(`category:${r.category}`),
            name: r.category,
            description: "Демонстрационная категория из Датасет.docx",
          },
        });
        const authorId = seedId(`user:${r.authorRole}`);
        const assigneeId = seedId(`user:${r.assigneeRole}`);
        const author = await db.user.findUniqueOrThrow({
          where: { id: authorId },
        });
        const rule = await db.routingRule.findFirst({
          where: { categoryId: category.id, departmentId: author.departmentId },
        });
        if (!rule)
          await db.routingRule.create({
            data: {
              id: seedId(`rule:${category.id}:${author.departmentId}`),
              categoryId: category.id,
              departmentId: author.departmentId,
              assigneeId,
            },
          });
        if (await db.ticket.findUnique({ where: { number: r.number } }))
          continue;
        const type = typeMap[r.sourceType as keyof typeof typeMap];
        const priority =
          priorityMap[r.sourcePriority as keyof typeof priorityMap];
        const status = statusMap[r.sourceStatus as keyof typeof statusMap];
        if (!type || !priority || !status)
          throw new Error(`Unmapped source value ${r.number}`);
        const index = Number(r.number.slice(2)) - 1;
        const createdAt = new Date(
          Date.parse("2026-11-01T08:00:00Z") + index * 12 * 3600000,
        );
        const steps = paths[status];
        const firstRespondedAt = steps.length
          ? new Date(createdAt.getTime() + 2 * 3600000)
          : null;
        const updatedAt = new Date(
          createdAt.getTime() + Math.max(1, steps.length) * 2 * 3600000,
        );
        const terminal = ["IMPLEMENTED", "REJECTED", "CLOSED"].includes(status);
        const resolution = terminal
          ? `[Синтетический результат для демонстрации] ${r.nextAction}`
          : null;
        const id = seedId(`ticket:${r.number}`);
        await db.ticket.create({
          data: {
            id,
            number: r.number,
            title: `${r.category} · ${r.number}`,
            description: r.description,
            type,
            priority,
            status,
            authorId,
            assigneeId,
            departmentId: author.departmentId,
            categoryId: category.id,
            dueAt: new Date(
              createdAt.getTime() +
                { HIGH: 2, MEDIUM: 5, LOW: 10 }[priority] * 86400000,
            ),
            createdAt,
            updatedAt,
            firstRespondedAt,
            closedAt: terminal ? updatedAt : null,
            outcome: terminal ? status : null,
            resolution,
            isSynthetic: true,
            sourceAuthorRole: r.authorRole,
            sourceAssigneeRole: r.assigneeRole,
          },
        });
        await db.ticketHistory.create({
          data: {
            id: seedId(`created:${r.number}`),
            ticketId: id,
            actorId: authorId,
            action: "CREATED",
            isSynthetic: true,
            createdAt,
            newValue: {
              number: r.number,
              status: "NEW",
              syntheticDates: true,
              source: "Датасет.docx",
            },
          },
        });
        await db.ticketHistory.create({
          data: {
            id: seedId(`assigned:${r.number}`),
            ticketId: id,
            actorId: seedId("admin@modus.local"),
            action: "ASSIGNED",
            isSynthetic: true,
            createdAt: new Date(createdAt.getTime() + 60000),
            newValue: {
              assigneeId,
              reason: "Исходный условный ответственный из датасета",
            },
          },
        });
        let previous: TicketStatus = "NEW";
        for (const [step, next] of steps.entries()) {
          const date = new Date(createdAt.getTime() + (step + 1) * 2 * 3600000);
          await db.ticketHistory.create({
            data: {
              id: seedId(`status:${r.number}:${step}`),
              ticketId: id,
              actorId: assigneeId,
              action: "STATUS_CHANGED",
              oldValue: { status: previous },
              newValue: {
                status: next,
                ...(next === status && resolution ? { resolution } : {}),
                syntheticDates: true,
              },
              isSynthetic: true,
              createdAt: date,
            },
          });
          previous = next;
        }
        if (steps.length) {
          const content = `[Синтетическое демонстрационное событие] ${r.nextAction}`;
          const comment = await db.ticketComment.create({
            data: {
              id: seedId(`comment:${r.number}`),
              ticketId: id,
              authorId: assigneeId,
              content,
              createdAt: firstRespondedAt!,
            },
          });
          await db.ticketHistory.create({
            data: {
              id: seedId(`comment-event:${r.number}`),
              ticketId: id,
              actorId: assigneeId,
              action:
                status === "NEEDS_CLARIFICATION"
                  ? "CLARIFICATION_REQUESTED"
                  : "COMMENTED",
              newValue: { commentId: comment.id, content },
              isSynthetic: true,
              createdAt: firstRespondedAt!,
            },
          });
        }
      }
    },
    { timeout: 60000 },
  );
  return { imported: source.length, syntheticDates: true };
}
