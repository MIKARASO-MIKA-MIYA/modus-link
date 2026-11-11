import { prisma } from "@/lib/prisma";
import type { Actor, TicketStatus, TicketType } from "@/types/domain";
import { terminalStatuses } from "@/types/domain";
import { analyticsScope } from "@/server/permissions";
export interface MetricTicket {
  status: TicketStatus;
  type: TicketType;
  outcome: TicketStatus | null;
  dueAt: Date;
  createdAt: Date;
  firstRespondedAt: Date | null;
  archivedAt: Date | null;
  category: { id: string; name: string };
  department: { id: string; name: string };
}
export function calculateMetrics(rows: MetricTicket[], now = new Date()) {
  const completed = rows.filter((t) => terminalStatuses.includes(t.status));
  const responded = rows.filter((t) => t.firstRespondedAt !== null);
  const groups = (key: "category" | "department") => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        total: number;
        completed: number;
        overdue: number;
        implemented: number;
        rejected: number;
      }
    >();
    for (const t of rows) {
      const group = map.get(t[key].id) ?? {
        ...t[key],
        total: 0,
        completed: 0,
        overdue: 0,
        implemented: 0,
        rejected: 0,
      };
      group.total++;
      if (terminalStatuses.includes(t.status)) group.completed++;
      else if (t.dueAt < now) group.overdue++;
      if (t.outcome === "IMPLEMENTED") group.implemented++;
      if (t.outcome === "REJECTED") group.rejected++;
      map.set(group.id, group);
    }
    return [...map.values()].sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name),
    );
  };
  return {
    asOf: now.toISOString(),
    total: rows.length,
    new: rows.filter((t) => t.status === "NEW").length,
    inProgress: rows.filter((t) => t.status === "IN_PROGRESS").length,
    underReview: rows.filter((t) => t.status === "UNDER_REVIEW").length,
    needsClarification: rows.filter((t) => t.status === "NEEDS_CLARIFICATION")
      .length,
    completed: completed.length,
    archived: rows.filter((t) => t.archivedAt).length,
    overdue: rows.filter(
      (t) => !terminalStatuses.includes(t.status) && t.dueAt < now,
    ).length,
    reviewed: responded.length,
    reviewedShare: rows.length ? responded.length / rows.length : 0,
    averageFirstResponseHours: responded.length
      ? responded.reduce(
          (sum, t) =>
            sum +
            (t.firstRespondedAt!.getTime() - t.createdAt.getTime()) / 3600000,
          0,
        ) / responded.length
      : null,
    firstResponseSampleSize: responded.length,
    implementedImprovements: rows.filter(
      (t) => t.type === "SUGGESTION" && t.outcome === "IMPLEMENTED",
    ).length,
    byType: (["PROBLEM", "SUGGESTION", "POSITIVE_FEEDBACK"] as const).map(
      (type) => ({ type, total: rows.filter((t) => t.type === type).length }),
    ),
    byStatus: (
      [
        "NEW",
        "UNDER_REVIEW",
        "NEEDS_CLARIFICATION",
        "IN_PROGRESS",
        "IMPLEMENTED",
        "REJECTED",
        "CLOSED",
      ] as const
    ).map((status) => ({
      status,
      total: rows.filter((t) => t.status === status).length,
    })),
    byCategory: groups("category"),
    byDepartment: groups("department"),
  };
}
export async function analytics(actor: Actor, days = "all") {
  const now = new Date();
  const from =
    days === "all" ? null : new Date(now.getTime() - Number(days) * 86400000);
  const rows = await prisma.ticket.findMany({
    where: {
      AND: [
        analyticsScope(actor),
        ...(from ? [{ createdAt: { gte: from } }] : []),
      ],
    },
    select: {
      status: true,
      type: true,
      outcome: true,
      assigneeId: true,
      closedAt: true,
      dueAt: true,
      createdAt: true,
      firstRespondedAt: true,
      archivedAt: true,
      category: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
  const completed = rows.filter(
    (t) => terminalStatuses.includes(t.status) && t.closedAt,
  );
  const onTime = completed.filter((t) => t.closedAt! <= t.dueAt).length;
  const open = rows.filter((t) => !terminalStatuses.includes(t.status));
  const trendStart =
    from ??
    new Date(
      Math.min(
        now.getTime() - 6 * 86400000,
        ...rows.map((t) => t.createdAt.getTime()),
      ),
    );
  const step = Math.max(
    86400000,
    Math.ceil((now.getTime() - trendStart.getTime()) / 86400000 / 30) *
      86400000,
  );
  const dailyTrend = Array.from(
    {
      length: Math.max(
        1,
        Math.ceil((now.getTime() - trendStart.getTime()) / step),
      ),
    },
    (_, i) => {
      const start = trendStart.getTime() + i * step,
        end = start + step;
      const within = (date: Date | null) =>
        date !== null && date.getTime() >= start && date.getTime() < end;
      return {
        date: new Date(start).toISOString(),
        created: rows.filter((t) => within(t.createdAt)).length,
        responded: rows.filter((t) => within(t.firstRespondedAt)).length,
        completed: rows.filter((t) => within(t.closedAt)).length,
      };
    },
  );
  return {
    ...calculateMetrics(rows, now),
    periodDays: days,
    unassigned: rows.filter(
      (t) => !t.assigneeId && !terminalStatuses.includes(t.status),
    ).length,
    onTimeShare: completed.length ? onTime / completed.length : null,
    deadlineDistribution: {
      onTime: open.filter(
        (t) => t.dueAt.getTime() > now.getTime() + 2 * 86400000,
      ).length,
      approaching: open.filter(
        (t) =>
          t.dueAt >= now && t.dueAt.getTime() <= now.getTime() + 2 * 86400000,
      ).length,
      overdue: open.filter((t) => t.dueAt < now).length,
    },
    dailyTrend,
    scope:
      actor.role === "ADMIN" || actor.canViewCompanyAnalytics
        ? "COMPANY"
        : actor.role === "MANAGER"
          ? "DEPARTMENT_AND_ASSIGNED"
          : "OWN",
    includesArchived: true,
  };
}
