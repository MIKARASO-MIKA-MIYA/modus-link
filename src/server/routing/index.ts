import type { Prisma } from "@/generated/prisma/client";
export async function resolveAssignee(
  db: Prisma.TransactionClient,
  categoryId: string,
  departmentId: string,
  authorId: string,
) {
  const rules = await db.routingRule.findMany({
    where: {
      categoryId,
      isActive: true,
      OR: [{ departmentId }, { departmentId: null }],
      assignee: {
        isActive: true,
        role: { in: ["MANAGER", "ADMIN"] },
        id: { not: authorId },
        department: { isActive: true },
      },
    },
    orderBy: { id: "asc" },
  });
  return (
    (
      rules.find((r) => r.departmentId === departmentId) ??
      rules.find((r) => r.departmentId === null)
    )?.assigneeId ?? null
  );
}
