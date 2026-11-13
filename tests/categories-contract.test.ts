import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Actor } from "@/types/api";
import { categoriesGet, categoriesPost, categoryPatch } from "@/server/handlers";
import { createTicket, getTicket } from "@/server/services/tickets";

const mocks = vi.hoisted(() => ({ actor: { id: "employee", username: "employee", name: "Employee", email: null, role: "ADMIN", departmentId: "department", canViewCompanyAnalytics: false } as Actor, category: { id: "11111111-1111-4111-8111-111111111111", name: "Категория", description: "Описание", isActive: true }, findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), ticketRead: vi.fn(), ticketCreate: vi.fn(), ticketUpdate: vi.fn(), ticketDelete: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const db = { category: { findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique, findFirst: mocks.findFirst, update: mocks.update, create: mocks.create }, ticket: { findFirst: mocks.ticketRead, create: mocks.ticketCreate, update: mocks.ticketUpdate, delete: mocks.ticketDelete }, $transaction: mocks.transaction };
  mocks.transaction.mockImplementation(async value => typeof value === "function" ? value(db) : Promise.all(value));
  return { prisma: db };
});
vi.mock("@/server/auth/session", async original => ({ ...await original<typeof import("@/server/auth/session")>(), currentActor: async () => mocks.actor }));
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://modus.example"); vi.stubEnv("VERCEL", "0"); mocks.actor.role = "ADMIN"; mocks.category.isActive = true;
  for (const mock of [mocks.findMany, mocks.count, mocks.findUnique, mocks.findFirst, mocks.update, mocks.create, mocks.ticketRead, mocks.ticketCreate, mocks.ticketUpdate, mocks.ticketDelete]) mock.mockReset();
  mocks.findMany.mockImplementation(async query => query.where.isActive && !mocks.category.isActive ? [] : [{ ...mocks.category }]); mocks.count.mockResolvedValue(1);
  mocks.findUnique.mockResolvedValue(mocks.category); mocks.findFirst.mockImplementation(async query => query.where.isActive && !mocks.category.isActive ? null : mocks.category);
  mocks.update.mockImplementation(async args => { Object.assign(mocks.category, args.data); return { ...mocks.category }; }); mocks.create.mockImplementation(async args => ({ id: mocks.category.id, ...args.data }));
  mocks.ticketRead.mockImplementation(async () => ({ id: "existing", title: "Существующее обращение", authorId: "employee", categoryId: mocks.category.id, category: { ...mocks.category } }));
});
afterEach(() => vi.unstubAllEnvs());
function request(method: string, body?: unknown) { return new NextRequest("https://modus.example/api/v1/categories", { method, ...(body ? { headers: { Origin: "https://modus.example", "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }); }
const context = () => ({ params: Promise.resolve({ id: mocks.category.id }) });

it.each(["EMPLOYEE", "MANAGER"] as const)("actual endpoints deny %s category writes before DB mutations", async role => {
  mocks.actor.role = role;
  expect((await categoriesPost(request("POST", { name: "Новая", description: null, isActive: true }))).status).toBe(403);
  expect((await categoryPatch(request("PATCH", { isActive: false }), context())).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.findUnique).not.toHaveBeenCalled();
});
it("actual endpoint creates categories for ADMIN using the existing schema", async () => {
  const response = await categoriesPost(request("POST", { name: " Новая ", description: null, isActive: true })); expect(response.status).toBe(201); expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Новая", description: null, isActive: true } });
});
it("deactivation preserves the existing ticket and rejects new tickets in that category", async () => {
  const response = await categoryPatch(request("PATCH", { isActive: false }), context()); expect(response.status).toBe(200); expect(mocks.category.isActive).toBe(false);
  const old = await getTicket({ ...mocks.actor, role: "EMPLOYEE" }, "existing"); expect(old).toMatchObject({ id: "existing", title: "Существующее обращение", categoryId: mocks.category.id });
  await expect(createTicket({ ...mocks.actor, role: "EMPLOYEE" }, { title: "Новое обращение", description: "Подробное описание", type: "PROBLEM", priority: "MEDIUM", categoryId: mocks.category.id })).rejects.toMatchObject({ status: 422, code: "INACTIVE_CATEGORY" });
  expect(mocks.ticketCreate).not.toHaveBeenCalled(); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.ticketDelete).not.toHaveBeenCalled();
});
it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("actual GET filters inactive categories correctly for %s", async role => {
  mocks.actor.role = role; mocks.category.isActive = false;
  const response = await categoriesGet(request("GET")); const result = await response.json();
  expect(mocks.findMany.mock.calls[0][0].where).toEqual(role === "ADMIN" ? {} : { isActive: true }); expect(result.data.items).toHaveLength(role === "ADMIN" ? 1 : 0);
});
it("invalid input receives validation errors without a DB mutation", async () => {
  const response = await categoriesPost(request("POST", { name: "x", description: "a".repeat(1001), isActive: true })); expect(response.status).toBe(422); const result = await response.json(); expect(result.error.details.map((row: { path: string }) => row.path)).toEqual(["name", "description"]); expect(mocks.create).not.toHaveBeenCalled();
});
