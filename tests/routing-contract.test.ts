import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/types/api";
import { Prisma } from "@/generated/prisma/client";
import { routingGet, routingPost, routingPatch } from "@/server/handlers";
import { saveRule } from "@/server/services/admin";
import { resolveAssignee } from "@/server/routing";

const mocks = vi.hoisted(() => ({ actor: { id: "actor", username: "actor", name: "Actor", email: null, role: "ADMIN", departmentId: "department", canViewCompanyAnalytics: true } as Actor, old: { id: "11111111-1111-4111-8111-111111111111", categoryId: "22222222-2222-4222-8222-222222222222", departmentId: "33333333-3333-4333-8333-333333333333", assigneeId: "44444444-4444-4444-8444-444444444444", isActive: true }, read: vi.fn(), list: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), user: vi.fn(), category: vi.fn(), department: vi.fn(), ticketUpdate: vi.fn(), tx: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const db = { routingRule: { findUnique: mocks.read, findMany: mocks.list, count: mocks.count, create: mocks.create, update: mocks.update }, user: { findFirst: mocks.user }, category: { findFirst: mocks.category }, department: { findFirst: mocks.department }, ticket: { update: mocks.ticketUpdate }, $transaction: mocks.tx };
  mocks.tx.mockImplementation(async value => typeof value === "function" ? value(db) : Promise.all(value)); return { prisma: db };
});
vi.mock("@/server/auth/session", async original => ({ ...await original<typeof import("@/server/auth/session")>(), currentActor: async () => mocks.actor }));
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://modus.example"); vi.stubEnv("VERCEL", "0"); mocks.actor.role = "ADMIN";
  for (const mock of [mocks.read, mocks.list, mocks.count, mocks.create, mocks.update, mocks.user, mocks.category, mocks.department, mocks.ticketUpdate]) mock.mockReset(); mocks.tx.mockClear();
  mocks.read.mockResolvedValue(mocks.old); mocks.list.mockResolvedValue([mocks.old]); mocks.count.mockResolvedValue(1); mocks.user.mockResolvedValue({ id: mocks.old.assigneeId }); mocks.category.mockResolvedValue({ id: mocks.old.categoryId }); mocks.department.mockResolvedValue({ id: mocks.old.departmentId }); mocks.create.mockImplementation(async args => args.data); mocks.update.mockImplementation(async args => args.data);
});
afterEach(() => vi.unstubAllEnvs());
function request(method: string, body?: unknown) { return new NextRequest("https://modus.example/api/v1/routing?pageSize=20&page=1", { method, ...(body ? { headers: { Origin: "https://modus.example", "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }); }
const context = () => ({ params: Promise.resolve({ id: mocks.old.id }) });
it.each(["EMPLOYEE", "MANAGER"] as const)("denies routing read and writes for %s even with company analytics", async role => {
  mocks.actor.role = role;
  expect((await routingGet(request("GET"))).status).toBe(403);
  expect((await routingPost(request("POST", { categoryId: mocks.old.categoryId, departmentId: null, assigneeId: mocks.old.assigneeId, isActive: true }))).status).toBe(403);
  expect((await routingPatch(request("PATCH", { isActive: false }), context())).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.tx).not.toHaveBeenCalled();
});
it("preserves 20-record pagination for ADMIN", async () => { expect((await routingGet(request("GET"))).status).toBe(200); expect(mocks.list.mock.calls[0][0]).toMatchObject({ skip: 0, take: 20 }); });
it("merges a status-only PATCH without replacing original links", async () => {
  await saveRule(mocks.actor, { isActive: false }, mocks.old.id); expect(mocks.update).toHaveBeenCalledWith({ where: { id: mocks.old.id }, data: { categoryId: mocks.old.categoryId, departmentId: mocks.old.departmentId, assigneeId: mocks.old.assigneeId, isActive: false } }); expect(mocks.ticketUpdate).not.toHaveBeenCalled();
});
it("changes a rule to global only when departmentId:null is explicit", async () => { await saveRule(mocks.actor, { departmentId: null }, mocks.old.id); expect(mocks.update.mock.calls[0][0].data).toMatchObject({ departmentId: null, categoryId: mocks.old.categoryId, assigneeId: mocks.old.assigneeId }); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); });
it.each(["user", "category", "department"] as const)("rejects an active rule with invalid %s linkage", async field => {
  mocks[field].mockResolvedValue(null); await expect(saveRule(mocks.actor, { isActive: true }, mocks.old.id)).rejects.toMatchObject({ status: 422, code: "INVALID_ROUTING" }); expect(mocks.update).not.toHaveBeenCalled();
});
it("checks active assignee role, account and department for active rules", async () => { await saveRule(mocks.actor, { isActive: true }, mocks.old.id); expect(mocks.user.mock.calls[0][0].where).toMatchObject({ role: { in: ["MANAGER", "ADMIN"] }, isActive: true, department: { isActive: true } }); expect(mocks.category.mock.calls[0][0].where.isActive).toBe(true); expect(mocks.department.mock.calls[0][0].where.isActive).toBe(true); });
it("documents the existing rejection of disabling a rule with a demoted assignee", async () => { mocks.user.mockResolvedValue(null); await expect(saveRule(mocks.actor, { isActive: false }, mocks.old.id)).rejects.toMatchObject({ code: "INVALID_ROUTING" }); expect(mocks.user.mock.calls[0][0].where.role).toEqual({ in: ["MANAGER", "ADMIN"] }); });
it("maps a unique-rule database conflict to HTTP 409", async () => { mocks.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate active rule", { code: "P2002", clientVersion: "7.10.1" })); const response = await routingPatch(request("PATCH", { isActive: true }), context()); expect(response.status).toBe(409); expect((await response.json()).error.code).toBe("CONFLICT"); });

async function resolve(rows: { id: string; departmentId: string | null; assigneeId: string }[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const result = await resolveAssignee({ routingRule: { findMany } } as unknown as Parameters<typeof resolveAssignee>[0], "category", "department", "author");
  return { result, query: findMany.mock.calls[0][0] };
}
it("prefers the local rule over an earlier global rule", async () => { const { result } = await resolve([{ id: "a", departmentId: null, assigneeId: "global" }, { id: "z", departmentId: "department", assigneeId: "local" }]); expect(result).toBe("local"); });
it("falls back to global when no eligible local rule is returned", async () => { expect((await resolve([{ id: "a", departmentId: null, assigneeId: "global" }])).result).toBe("global"); });
it("leaves a ticket unassigned when no eligible rule is returned", async () => { expect((await resolve([])).result).toBeNull(); });
it("excludes the author, inactive assignees and inactive assignee departments in the query", async () => { const { query } = await resolve([]); expect(query.where).toMatchObject({ categoryId: "category", isActive: true, OR: [{ departmentId: "department" }, { departmentId: null }], assignee: { id: { not: "author" }, isActive: true, role: { in: ["MANAGER", "ADMIN"] }, department: { isActive: true } } }); expect(query.where).not.toHaveProperty("type"); expect(query.where).not.toHaveProperty("priority"); });
