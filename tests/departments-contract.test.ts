import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/types/api";
import { departmentsGet, departmentsPost, departmentPatch } from "@/server/handlers";

const mocks = vi.hoisted(() => ({ actor: { id: "actor", username: "actor", name: "Actor", email: null, role: "ADMIN", departmentId: "11111111-1111-4111-8111-111111111111", canViewCompanyAnalytics: false } as Actor, department: { id: "11111111-1111-4111-8111-111111111111", name: "Отдел", isActive: true }, findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), userCount: vi.fn(), userUpdate: vi.fn(), ticketUpdate: vi.fn(), ruleUpdate: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { department: { findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique, create: mocks.create, update: mocks.update }, user: { count: mocks.userCount, update: mocks.userUpdate }, ticket: { update: mocks.ticketUpdate }, routingRule: { update: mocks.ruleUpdate }, $transaction: mocks.transaction } }));
vi.mock("@/server/auth/session", async original => ({ ...await original<typeof import("@/server/auth/session")>(), currentActor: async () => mocks.actor }));
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://modus.example"); vi.stubEnv("VERCEL", "0"); mocks.actor.role = "ADMIN"; mocks.actor.canViewCompanyAnalytics = false; mocks.department.name = "Отдел"; mocks.department.isActive = true;
  for (const mock of [mocks.findMany, mocks.count, mocks.findUnique, mocks.create, mocks.update, mocks.userCount, mocks.userUpdate, mocks.ticketUpdate, mocks.ruleUpdate, mocks.transaction]) mock.mockReset();
  mocks.findMany.mockResolvedValue([mocks.department]); mocks.count.mockResolvedValue(1); mocks.findUnique.mockResolvedValue(mocks.department); mocks.userCount.mockResolvedValue(0);
  mocks.transaction.mockImplementation(async values => Promise.all(values)); mocks.create.mockImplementation(async args => ({ ...args.data, id: mocks.department.id })); mocks.update.mockImplementation(async args => { Object.assign(mocks.department, args.data); return { ...mocks.department }; });
});
afterEach(() => vi.unstubAllEnvs());
function request(method: string, body?: unknown) { return new NextRequest("https://modus.example/api/v1/departments?pageSize=20&page=1", { method, ...(body ? { headers: { Origin: "https://modus.example", "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }); }
const context = () => ({ params: Promise.resolve({ id: mocks.department.id }) });
it.each(["EMPLOYEE", "MANAGER"] as const)("rejects %s writes even with company analytics", async role => {
  mocks.actor.role = role; mocks.actor.canViewCompanyAnalytics = true;
  expect((await departmentsPost(request("POST", { name: "Отдел", isActive: true }))).status).toBe(403);
  expect((await departmentPatch(request("PATCH", { isActive: false }), context())).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.userCount).not.toHaveBeenCalled();
});
it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("preserves %s GET scope and pagination", async role => {
  mocks.actor.role = role; expect((await departmentsGet(request("GET"))).status).toBe(200);
  expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: role === "ADMIN" ? {} : { id: mocks.actor.departmentId }, take: 20, skip: 0 });
});
it.each(["EMPLOYEE", "MANAGER"] as const)("explicit company analytics extends %s reading only", async role => {
  mocks.actor.role = role; mocks.actor.canViewCompanyAnalytics = true; await departmentsGet(request("GET")); expect(mocks.findMany.mock.calls[0][0].where).toEqual({});
  expect((await departmentPatch(request("PATCH", { name: "Изменение" }), context())).status).toBe(403); expect(mocks.update).not.toHaveBeenCalled();
});
it("allows ADMIN to create using the existing validated fields", async () => {
  expect((await departmentsPost(request("POST", { name: " Новый отдел ", isActive: true }))).status).toBe(201);
  expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Новый отдел", isActive: true } });
});
it("rejects deactivation with active users and does not mutate the department", async () => {
  mocks.userCount.mockResolvedValue(1); const response = await departmentPatch(request("PATCH", { name: "Новое имя", isActive: false }), context());
  expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("HAS_ACTIVE_USERS"); expect(mocks.userCount).toHaveBeenCalledWith({ where: { departmentId: mocks.department.id, isActive: true } }); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.department).toMatchObject({ name: "Отдел", isActive: true });
});
it("allows deactivation with no active users without rewriting linked records", async () => {
  const response = await departmentPatch(request("PATCH", { isActive: false }), context()); expect(response.status).toBe(200); expect(mocks.department.isActive).toBe(false); expect(mocks.update).toHaveBeenCalledWith({ where: { id: mocks.department.id }, data: { isActive: false } });
  expect(mocks.userUpdate).not.toHaveBeenCalled(); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.ruleUpdate).not.toHaveBeenCalled();
});
it("renames an active department without changing links or running the deactivation check", async () => {
  const response = await departmentPatch(request("PATCH", { name: "Новое имя" }), context()); expect(response.status).toBe(200); expect(mocks.department).toMatchObject({ name: "Новое имя", isActive: true }); expect(mocks.userCount).not.toHaveBeenCalled(); expect(mocks.userUpdate).not.toHaveBeenCalled(); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.ruleUpdate).not.toHaveBeenCalled();
});
it.each(["x", "a".repeat(121)])("rejects invalid name length before creation", async name => {
  expect((await departmentsPost(request("POST", { name, isActive: true }))).status).toBe(422); expect(mocks.create).not.toHaveBeenCalled();
});
