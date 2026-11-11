import { describe, expect, it } from "vitest";
import {
  createTicketSchema,
  filterSchema,
  statusSchema,
} from "@/server/validators";
import { canManage, ticketScope, analyticsScope } from "@/server/permissions";
import { defaultDueAt, validateTransition } from "@/server/services/workflow";
import {
  calculateMetrics,
  type MetricTicket,
} from "@/server/services/analytics";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { Actor } from "@/types/domain";
const employee: Actor = {
  id: "author",
  name: "Author",
  username: "author",
  email: "a@example.test",
  role: "EMPLOYEE",
  departmentId: "dep-a",
  canViewCompanyAnalytics: false,
};
const manager: Actor = { ...employee, id: "manager", role: "MANAGER" };
describe("Validation and workflow", () => {
  it("rejects missing fields and client role escalation", () => {
    expect(createTicketSchema.safeParse({}).success).toBe(false);
    expect(
      createTicketSchema.safeParse({
        title: "Title",
        description: "Long description",
        type: "PROBLEM",
        categoryId: "54ca4368-7f0f-46bb-bd86-2c49efdd5df8",
        role: "ADMIN",
      }).success,
    ).toBe(false);
  });
  it("does not coerce false into true and bounds pagination", () => {
    expect(filterSchema.parse({ overdue: "false" }).overdue).toBe(false);
    expect(filterSchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(filterSchema.safeParse({ arbitrary: "x" }).success).toBe(false);
  });
  it("requires rejection reason and clarification question", () => {
    expect(() => validateTransition("UNDER_REVIEW", "REJECTED")).toThrow();
    expect(() =>
      validateTransition("UNDER_REVIEW", "NEEDS_CLARIFICATION"),
    ).toThrow();
    expect(() =>
      validateTransition("UNDER_REVIEW", "REJECTED", "Обоснованный отказ"),
    ).not.toThrow();
  });
  it("does not allow skipping review or reopening closed tickets", () => {
    expect(() => validateTransition("NEW", "CLOSED", "Результат")).toThrow();
    expect(() => validateTransition("CLOSED", "NEW")).toThrow();
    expect(statusSchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(
      false,
    );
  });
  it("assigns deterministic priority deadlines", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(defaultDueAt("HIGH", now).toISOString()).toBe(
      "2026-11-03T00:00:00.000Z",
    );
  });
});
describe("Permissions", () => {
  const ticket = {
    authorId: employee.id,
    departmentId: employee.departmentId,
    assigneeId: null,
  };
  it("scopes employee queries to author", () => {
    expect(ticketScope(employee)).toEqual({ authorId: employee.id });
    expect(canManage(employee, ticket)).toBe(false);
  });
  it("limits manager by department or assignment", () => {
    expect(canManage(manager, ticket)).toBe(true);
    expect(canManage({ ...manager, departmentId: "elsewhere" }, ticket)).toBe(
      false,
    );
    expect(
      canManage(
        { ...manager, departmentId: "elsewhere" },
        { ...ticket, assigneeId: manager.id },
      ),
    ).toBe(true);
  });
  it("blocks self approval even for admin", () =>
    expect(canManage({ ...employee, role: "ADMIN" }, ticket)).toBe(false));
  it("grants owner only company analytics", () => {
    const owner = { ...employee, canViewCompanyAnalytics: true };
    expect(analyticsScope(owner)).toEqual({});
    expect(ticketScope(owner)).toEqual({ authorId: employee.id });
  });
});
describe("Analytics", () => {
  const base: MetricTicket = {
    status: "NEW",
    type: "SUGGESTION",
    outcome: null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    dueAt: new Date("2026-11-03T00:00:00Z"),
    firstRespondedAt: null,
    archivedAt: null,
    category: { id: "c", name: "Категория" },
    department: { id: "d", name: "Отдел" },
  };
  it("uses timestamps, excludes unanswered from response average, retains implemented outcome", () => {
    const result = calculateMetrics(
      [
        base,
        {
          ...base,
          status: "CLOSED",
          outcome: "IMPLEMENTED",
          archivedAt: new Date("2026-11-04T00:00:00Z"),
          firstRespondedAt: new Date("2026-11-01T06:00:00Z"),
        },
        {
          ...base,
          status: "IN_PROGRESS",
          firstRespondedAt: new Date("2026-11-01T02:00:00Z"),
        },
      ],
      new Date("2026-11-11T00:00:00Z"),
    );
    expect(result).toMatchObject({
      total: 3,
      new: 1,
      overdue: 2,
      completed: 1,
      archived: 1,
      averageFirstResponseHours: 4,
      reviewedShare: 2 / 3,
      implementedImprovements: 1,
      firstResponseSampleSize: 2,
    });
    expect(result.byDepartment[0].completed).toBe(1);
  });
  it("handles an empty register without fabricated average", () =>
    expect(calculateMetrics([])).toMatchObject({
      total: 0,
      reviewedShare: 0,
      averageFirstResponseHours: null,
    }));
});
it("salts password hashes and verifies without storing plaintext", async () => {
  const a = await hashPassword("ExamplePassword!1");
  const b = await hashPassword("ExamplePassword!1");
  expect(a).not.toEqual(b);
  expect(a).not.toContain("ExamplePassword");
  expect(await verifyPassword("ExamplePassword!1", a)).toBe(true);
  expect(await verifyPassword("wrong", a)).toBe(false);
});
