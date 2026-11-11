import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/types/domain";
import type { TicketFilter } from "@/server/validators";
import { terminalStatuses } from "@/types/domain";
import { ticketScope } from "@/server/permissions";
export const userSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  departmentId: true,
} as const;
export const actorSelect = {
  ...userSelect,
  email: true,
  canViewCompanyAnalytics: true,
} as const;
export const ticketInclude = {
  category: true,
  department: true,
  author: { select: userSelect },
  assignee: { select: userSelect },
} as const;
export function ticketWhere(
  actor: Actor,
  f: TicketFilter,
  now = new Date(),
): Prisma.TicketWhereInput {
  const filters: Prisma.TicketWhereInput[] = [
    ticketScope(actor),
    ...(f.includeArchived && !f.archived
      ? []
      : [{ archivedAt: f.archived ? { not: null } : null }]),
  ];
  if (f.stateGroup === "ACTIVE")
    filters.push({ status: { in: ["UNDER_REVIEW", "IN_PROGRESS"] } });
  if (f.stateGroup === "COMPLETED")
    filters.push({ status: { in: terminalStatuses } });
  if (f.stateGroup === "IMPLEMENTED") filters.push({ outcome: "IMPLEMENTED" });
  for (const key of [
    "categoryId",
    "status",
    "departmentId",
    "type",
    "priority",
    "authorId",
    "assigneeId",
  ] as const)
    if (f[key]) filters.push({ [key]: f[key] });
  if (f.dueBefore || f.dueAfter)
    filters.push({
      dueAt: {
        ...(f.dueBefore ? { lte: new Date(f.dueBefore) } : {}),
        ...(f.dueAfter ? { gte: new Date(f.dueAfter) } : {}),
      },
    });
  if (f.unassigned !== undefined)
    filters.push({ assigneeId: f.unassigned ? null : { not: null } });
  if (f.overdue !== undefined)
    filters.push(
      f.overdue
        ? { dueAt: { lt: now }, status: { notIn: terminalStatuses } }
        : {
            OR: [{ dueAt: { gte: now } }, { status: { in: terminalStatuses } }],
          },
    );
  if (f.q)
    filters.push({
      OR: [
        ...["title", "description", "number"].map((key) => ({
          [key]: { contains: f.q, mode: "insensitive" },
        })),
        { author: { name: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  return { AND: filters };
}
export async function listTickets(actor: Actor, filters: TicketFilter) {
  const where = ticketWhere(actor, filters);
  const [items, total] = await prisma.$transaction(
    [
      prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: [{ [filters.sortBy]: filters.order }, { id: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.ticket.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    items,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  };
}
