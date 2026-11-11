import { z } from "zod";
import type { Prisma, Ticket } from "@/generated/prisma/client";
import type { Actor } from "@/types/domain";
import { terminalStatuses } from "@/types/domain";
import { prisma } from "@/lib/prisma";
import { ensure } from "@/server/errors";
import { ticketScope, canManage, requireManager } from "@/server/permissions";
import { ticketInclude, userSelect } from "@/server/repositories/tickets";
import { resolveAssignee } from "@/server/routing";
import { defaultDueAt, validateTransition } from "./workflow";
import {
  archiveSchema,
  assignSchema,
  commentSchema,
  createTicketSchema,
  statusSchema,
  updateTicketSchema,
} from "@/server/validators";
export async function getTicket(
  actor: Actor,
  id: string,
  db: Prisma.TransactionClient = prisma,
) {
  const ticket = await db.ticket.findFirst({
    where: { AND: [{ id }, ticketScope(actor)] },
    include: ticketInclude,
  });
  ensure(ticket, 404, "NOT_FOUND", "Обращение не найдено");
  return ticket;
}
async function change(
  db: Prisma.TransactionClient,
  ticket: Ticket,
  version: number,
  data: Prisma.TicketUncheckedUpdateManyInput,
) {
  const result = await db.ticket.updateMany({
    where: { id: ticket.id, version },
    data: { ...data, version: { increment: 1 } },
  });
  ensure(
    result.count === 1,
    409,
    "VERSION_CONFLICT",
    "Обращение изменилось. Обновите данные перед повтором",
  );
}
function active(ticket: Ticket) {
  ensure(
    !ticket.archivedAt,
    409,
    "ARCHIVED",
    "Сначала восстановите обращение из архива",
  );
}
const history = (
  db: Prisma.TransactionClient,
  ticketId: string,
  actorId: string,
  action: Prisma.TicketHistoryCreateInput["action"],
  oldValue: Prisma.InputJsonValue,
  newValue: Prisma.InputJsonValue,
  visibility: "PUBLIC" | "INTERNAL" = "PUBLIC",
) =>
  db.ticketHistory.create({
    data: { ticketId, actorId, action, oldValue, newValue, visibility },
  });
export async function createTicket(
  actor: Actor,
  input: z.infer<typeof createTicketSchema>,
) {
  return prisma.$transaction(async (db) => {
    const category = await db.category.findFirst({
      where: { id: input.categoryId, isActive: true },
    });
    ensure(
      category,
      422,
      "INACTIVE_CATEGORY",
      "Выберите действующую категорию",
    );
    const assigneeId = await resolveAssignee(
      db,
      input.categoryId,
      actor.departmentId,
      actor.id,
    );
    const ticket = await db.ticket.create({
      data: {
        ...input,
        authorId: actor.id,
        departmentId: actor.departmentId,
        assigneeId,
        dueAt: defaultDueAt(input.priority),
      },
      include: ticketInclude,
    });
    await history(
      db,
      ticket.id,
      actor.id,
      "CREATED",
      {},
      {
        status: "NEW",
        number: ticket.number,
        title: ticket.title,
        description: ticket.description,
        type: ticket.type,
        categoryId: ticket.categoryId,
        priority: ticket.priority,
        dueAt: ticket.dueAt.toISOString(),
      },
    );
    await history(
      db,
      ticket.id,
      actor.id,
      "ASSIGNED",
      { assigneeId: null },
      {
        assigneeId,
        automatic: true,
        reason: assigneeId
          ? "Правило маршрутизации"
          : "Нет подходящего правила — очередь нераспределённых",
      },
    );
    return ticket;
  });
}
export async function updateTicket(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateTicketSchema>,
) {
  return prisma.$transaction(async (db) => {
    const ticket = await getTicket(actor, id, db);
    active(ticket);
    ensure(
      !terminalStatuses.includes(ticket.status),
      409,
      "COMPLETED",
      "Завершённое обращение нельзя редактировать",
    );
    const { version, ...fields } = input;
    if (actor.id === ticket.authorId) {
      ensure(
        ticket.status === "NEW" &&
          input.priority === undefined &&
          input.dueAt === undefined,
        403,
        "FORBIDDEN",
        "Автор может менять только заголовок и описание нового обращения",
      );
    } else requireManager(actor, ticket);
    const old: Record<string, string> = {};
    const next: Record<string, string> = {};
    for (const key of ["title", "description", "priority", "dueAt"] as const)
      if (fields[key] !== undefined) {
        old[key] = key === "dueAt" ? ticket.dueAt.toISOString() : ticket[key];
        next[key] = fields[key]!;
      }
    await change(db, ticket, version, {
      ...fields,
      ...(input.dueAt ? { dueAt: new Date(input.dueAt) } : {}),
    });
    await history(db, id, actor.id, "UPDATED", old, next);
    return getTicket(actor, id, db);
  });
}
export async function assignTicket(
  actor: Actor,
  id: string,
  input: z.infer<typeof assignSchema>,
) {
  return prisma.$transaction(async (db) => {
    const ticket = await getTicket(actor, id, db);
    active(ticket);
    requireManager(actor, ticket);
    ensure(
      !terminalStatuses.includes(ticket.status),
      409,
      "COMPLETED",
      "Завершённое обращение нельзя переназначать",
    );
    ensure(
      actor.role === "ADMIN" || ticket.departmentId === actor.departmentId,
      403,
      "FORBIDDEN",
      "Переназначение за пределами подразделения выполняет администратор",
    );
    if (input.assigneeId) {
      const user = await db.user.findFirst({
        where: {
          id: input.assigneeId,
          isActive: true,
          role: { in: ["MANAGER", "ADMIN"] },
          department: { isActive: true },
        },
      });
      ensure(
        user && user.id !== ticket.authorId,
        422,
        "INVALID_ASSIGNEE",
        "Нужен активный ответственный, отличный от автора",
      );
      ensure(
        actor.role === "ADMIN" || user.departmentId === actor.departmentId,
        403,
        "FORBIDDEN",
        "Назначение за пределами подразделения выполняет администратор",
      );
    }
    await change(db, ticket, input.version, { assigneeId: input.assigneeId });
    await history(
      db,
      id,
      actor.id,
      "ASSIGNED",
      { assigneeId: ticket.assigneeId },
      { assigneeId: input.assigneeId, automatic: false, reason: input.reason },
    );
    return getTicket(actor, id, db);
  });
}
export async function setStatus(
  actor: Actor,
  id: string,
  input: z.infer<typeof statusSchema>,
) {
  return prisma.$transaction(async (db) => {
    const ticket = await getTicket(actor, id, db);
    active(ticket);
    requireManager(actor, ticket);
    const resolution = input.resolution ?? ticket.resolution ?? undefined;
    // Rejection always requires a fresh reason in this request.
    validateTransition(
      ticket.status,
      input.status,
      input.status === "REJECTED" ? input.resolution : resolution,
      input.message,
    );
    const now = new Date();
    const terminal = terminalStatuses.includes(input.status);
    await change(db, ticket, input.version, {
      status: input.status,
      ...(terminal
        ? {
            resolution,
            closedAt: ticket.closedAt ?? now,
            outcome: ticket.outcome ?? input.status,
          }
        : {}),
      firstRespondedAt: ticket.firstRespondedAt ?? now,
    });
    await history(
      db,
      id,
      actor.id,
      "STATUS_CHANGED",
      { status: ticket.status, resolution: ticket.resolution },
      {
        status: input.status,
        ...(terminal ? { resolution: resolution! } : {}),
      },
    );
    if (input.message) {
      const comment = await db.ticketComment.create({
        data: {
          ticketId: id,
          authorId: actor.id,
          content: input.message,
          visibility: "PUBLIC",
        },
      });
      await history(
        db,
        id,
        actor.id,
        input.status === "NEEDS_CLARIFICATION"
          ? "CLARIFICATION_REQUESTED"
          : "COMMENTED",
        {},
        { commentId: comment.id, content: input.message },
      );
    }
    return getTicket(actor, id, db);
  });
}
export async function addComment(
  actor: Actor,
  id: string,
  input: z.infer<typeof commentSchema>,
) {
  return prisma.$transaction(async (db) => {
    const ticket = await getTicket(actor, id, db);
    active(ticket);
    const manager = canManage(actor, ticket);
    ensure(
      actor.id === ticket.authorId || manager,
      403,
      "FORBIDDEN",
      "Нет права добавлять комментарии",
    );
    ensure(
      input.visibility === "PUBLIC" || manager,
      403,
      "FORBIDDEN",
      "Внутренние комментарии доступны обработчикам",
    );
    const clarification =
      actor.id === ticket.authorId && ticket.status === "NEEDS_CLARIFICATION";
    await change(db, ticket, input.version, {
      ...(clarification ? { status: "UNDER_REVIEW" } : {}),
      ...(manager && input.visibility === "PUBLIC" && !ticket.firstRespondedAt
        ? { firstRespondedAt: new Date() }
        : {}),
    });
    const comment = await db.ticketComment.create({
      data: {
        ticketId: id,
        authorId: actor.id,
        content: input.content,
        visibility: input.visibility,
      },
      include: { author: { select: userSelect } },
    });
    await history(
      db,
      id,
      actor.id,
      clarification ? "CLARIFICATION_PROVIDED" : "COMMENTED",
      {},
      { commentId: comment.id, content: input.content },
      input.visibility,
    );
    if (clarification)
      await history(
        db,
        id,
        actor.id,
        "STATUS_CHANGED",
        { status: "NEEDS_CLARIFICATION" },
        { status: "UNDER_REVIEW", reason: "Получен ответ автора" },
      );
    return { comment, ticket: await getTicket(actor, id, db) };
  });
}
export async function archiveTicket(
  actor: Actor,
  id: string,
  input: z.infer<typeof archiveSchema>,
) {
  return prisma.$transaction(async (db) => {
    const ticket = await getTicket(actor, id, db);
    requireManager(actor, ticket);
    ensure(
      terminalStatuses.includes(ticket.status) && ticket.resolution,
      409,
      "UNRESOLVED",
      "Архивирование возможно только после фиксации результата",
    );
    ensure(
      Boolean(ticket.archivedAt) !== input.archived,
      409,
      "CONFLICT",
      "Архивное состояние уже установлено",
    );
    const archivedAt = input.archived ? new Date() : null;
    await change(db, ticket, input.version, { archivedAt });
    await history(
      db,
      id,
      actor.id,
      input.archived ? "ARCHIVED" : "RESTORED",
      { archivedAt: ticket.archivedAt?.toISOString() ?? null },
      { archivedAt: archivedAt?.toISOString() ?? null, reason: input.reason },
    );
    return getTicket(actor, id, db);
  });
}
export async function ticketEvents(
  actor: Actor,
  id: string,
  kind: "history" | "comments",
  page: number,
  pageSize: number,
) {
  const ticket = await getTicket(actor, id);
  const where = {
    ticketId: id,
    ...(canManage(actor, ticket) ? {} : { visibility: "PUBLIC" as const }),
  };
  const args = {
    where,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
  const [items, total] =
    kind === "history"
      ? await prisma.$transaction(
          [
            prisma.ticketHistory.findMany({
              ...args,
              include: { actor: { select: userSelect } },
            }),
            prisma.ticketHistory.count({ where }),
          ],
          { isolationLevel: "RepeatableRead" },
        )
      : await prisma.$transaction(
          [
            prisma.ticketComment.findMany({
              ...args,
              include: { author: { select: userSelect } },
            }),
            prisma.ticketComment.count({ where }),
          ],
          { isolationLevel: "RepeatableRead" },
        );
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
