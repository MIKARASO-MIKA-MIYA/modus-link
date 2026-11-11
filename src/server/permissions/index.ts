import type { Prisma, Ticket } from "@/generated/prisma/client";
import type { Actor } from "@/types/domain";
import { ensure } from "@/server/errors";
export function ticketScope(actor: Actor): Prisma.TicketWhereInput {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "MANAGER")
    return {
      OR: [
        { authorId: actor.id },
        { departmentId: actor.departmentId },
        { assigneeId: actor.id },
      ],
    };
  return { authorId: actor.id };
}
export function canManage(
  actor: Actor,
  ticket: Pick<Ticket, "authorId" | "departmentId" | "assigneeId">,
) {
  return (
    actor.id !== ticket.authorId &&
    (actor.role === "ADMIN" ||
      (actor.role === "MANAGER" &&
        (actor.departmentId === ticket.departmentId ||
          actor.id === ticket.assigneeId)))
  );
}
export function requireManager(
  actor: Actor,
  ticket: Pick<Ticket, "authorId" | "departmentId" | "assigneeId">,
) {
  ensure(
    canManage(actor, ticket),
    403,
    "FORBIDDEN",
    "Нет полномочий на обработку обращения (своё обращение обрабатывает другой ответственный)",
  );
}
export function requireAdmin(actor: Actor) {
  ensure(
    actor.role === "ADMIN",
    403,
    "FORBIDDEN",
    "Требуются права администратора",
  );
}
export function analyticsScope(actor: Actor): Prisma.TicketWhereInput {
  return actor.canViewCompanyAnalytics || actor.role === "ADMIN"
    ? {}
    : ticketScope(actor);
}
