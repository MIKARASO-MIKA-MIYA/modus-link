import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/types/api";
import { usersGet } from "@/server/handlers";
import { createUser, updateUser } from "@/server/services/admin";
import { registerSchema } from "@/server/validators";

const mocks = vi.hoisted(() => ({ actor: { id: "actor", username: "actor", name: "Actor", email: null, role: "EMPLOYEE", departmentId: "department", canViewCompanyAnalytics: false } as Actor, findMany: vi.fn(), count: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.findMany, count: mocks.count }, $transaction: mocks.transaction } }));
vi.mock("@/server/auth/session", async original => ({ ...await original<typeof import("@/server/auth/session")>(), currentActor: async () => mocks.actor }));
beforeEach(() => { mocks.actor = { ...mocks.actor, role: "EMPLOYEE", canViewCompanyAnalytics: false }; mocks.findMany.mockReset().mockResolvedValue([]); mocks.count.mockReset().mockResolvedValue(0); mocks.transaction.mockReset().mockImplementation(async promises => Promise.all(promises)); });

it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("the actual users GET limits the %s query and returned fields", async role => {
  mocks.actor.role = role;
  const response = await usersGet(new NextRequest("http://localhost/api/v1/users?pageSize=20&page=1"));
  expect(response.status).toBe(200);
  const query = mocks.findMany.mock.calls[0][0];
  expect(query.where).toEqual(role === "ADMIN" ? {} : role === "MANAGER" ? { departmentId: "department", isActive: true } : { id: "actor" });
  expect(query.take).toBe(20);
  expect(query.select).not.toHaveProperty("passwordHash");
  expect(!!query.select.email).toBe(role === "ADMIN"); expect(!!query.select.canViewCompanyAnalytics).toBe(role === "ADMIN");
});
it.each(["EMPLOYEE", "MANAGER"] as const)("company-analytics privilege does not widen the %s user directory", async role => {
  mocks.actor.role = role; mocks.actor.canViewCompanyAnalytics = true;
  await usersGet(new NextRequest("http://localhost/api/v1/users"));
  expect(mocks.findMany.mock.calls[0][0].where).toEqual(role === "EMPLOYEE" ? { id: "actor" } : { departmentId: "department", isActive: true });
});
it.each(["EMPLOYEE", "MANAGER"] as const)("rejects role escalation and account creation by %s before database access", async role => {
  const actor = { ...mocks.actor, role, canViewCompanyAnalytics: true };
  await expect(updateUser(actor, "other", { role: "ADMIN", canViewCompanyAnalytics: true })).rejects.toMatchObject({ status: 403 });
  await expect(createUser(actor, { name: "New", username: "new", password: "secure-password", departmentId: "department", role: "ADMIN", canViewCompanyAnalytics: true })).rejects.toMatchObject({ status: 403 });
  expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.findMany).not.toHaveBeenCalled(); expect(mocks.count).not.toHaveBeenCalled();
});
it("rejects admin self-edit before database access", async () => {
  await expect(updateUser({ ...mocks.actor, role: "ADMIN" }, "actor", { role: "EMPLOYEE" })).rejects.toMatchObject({ status: 403, code: "SELF_ADMIN_CHANGE" });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("rejects role and analytics-privilege injection in registration", () => {
  expect(registerSchema.safeParse({ username: "employee", password: "secure-password", role: "ADMIN", canViewCompanyAnalytics: true }).success).toBe(false);
});
