// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUserDto, CategoryDto, DepartmentDto, RoutingDto } from "@/types/api";
import { RoutingEditor } from "@/components/routing-editor";
import { AdminDirectory } from "@/components/admin-directory";
import { ApiRequestError } from "@/lib/client-api";
const mocks = vi.hoisted(() => ({ role: "ADMIN", mode: "ready", urls: [] as string[], write: vi.fn(), refresh: vi.fn(), close: vi.fn(), saved: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor: { role: mocks.role, canViewCompanyAnalytics: true, id: "admin" } }) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  if (url) mocks.urls.push(url);
  const name = url?.split("?")[0] ?? "none";
  return { data: !url || mocks.mode !== "ready" && mocks.mode !== "empty" ? null : { items: mocks.mode === "empty" ? [] : name === "routing" ? [rule] : name === "categories" ? categories : name === "users" ? users : departments, pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }, loading: !!url && mocks.mode === "loading", error: !!url && mocks.mode === "error" ? "Ошибка списка" : null, refresh: () => mocks.refresh(name) };
} }));
const category: CategoryDto = { id: "old-category", name: "Исходная категория", description: null, isActive: true };
const department: DepartmentDto = { id: "old-department", name: "Исходное подразделение", isActive: true };
const manager: AdminUserDto = { id: "old-manager", username: "manager", name: "Исходный исполнитель", role: "MANAGER", departmentId: "staff-department", isActive: true, email: null, canViewCompanyAnalytics: false };
let categories: CategoryDto[], departments: DepartmentDto[], users: AdminUserDto[], rule: RoutingDto;
let modes: Record<string, string>, container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.role = "ADMIN"; mocks.mode = "ready"; mocks.urls = []; mocks.write.mockReset().mockResolvedValue({}); mocks.refresh.mockReset(); mocks.close.mockReset(); mocks.saved.mockReset(); modes = {};
  categories = [{ ...category }]; departments = [{ ...department }, { id: "staff-department", name: "Отдел исполнителя", isActive: true }]; users = [{ ...manager }]; rule = { id: "rule", categoryId: category.id, departmentId: department.id, assigneeId: manager.id, isActive: true, category, department, assignee: manager };
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } }, close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });
function lookup<T>(items: T[], name: string) { return { data: modes[name] === "loading" || modes[name] === "error" ? null : { items, pagination: { page: 1, pageSize: 100, total: 150, totalPages: 2 } }, loading: modes[name] === "loading", error: modes[name] === "error" ? `Ошибка ${name}` : null, refresh: () => mocks.refresh(name) }; }
async function editor(existing: RoutingDto | null = rule) { await act(async () => root.render(<RoutingEditor rule={existing} categories={lookup(categories, "categories")} departments={lookup(departments, "departments")} users={lookup(users, "users")} onClose={mocks.close} onSaved={mocks.saved} />)); }
async function page() { await act(async () => root.render(<AdminDirectory kind="routing" />)); }
function select(name: string) { return container.querySelector<HTMLSelectElement>(`[name="${name}"]`)!; }
async function change(name: string, value: string) { await act(async () => { select(name).value = value; select(name).dispatchEvent(new Event("change", { bubbles: true })); }); }
async function toggle() { await act(async () => container.querySelector<HTMLInputElement>('[name="isActive"]')!.click()); }
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
for (const theme of ["light", "dark"]) describe(`${theme} routing behavior (DOM fixtures, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER"])("denies management and directory requests for %s with company analytics", async role => { mocks.role = role; await page(); expect(container.textContent).toContain("Нет доступа"); expect(container.querySelector("button")).toBeNull(); expect(mocks.urls).toEqual([]); });
  it.each(["loading", "error", "empty"])("separates the %s rule-list state", async mode => {
    mocks.mode = mode; await page(); expect(container.querySelector(mode === "loading" ? ".loading-state" : mode === "error" ? '[role="alert"]' : ".empty-state")).not.toBeNull(); expect(container.querySelector(".data-table")).toBeNull();
    if (mode === "error") { await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledWith("routing"); expect(container.querySelector(".empty-state")).toBeNull(); }
  });
  it("keeps 20-record pagination", async () => { await page(); expect(mocks.urls).toContain("routing?pageSize=20&page=1"); await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent === "Далее")!.click()); expect(mocks.urls).toContain("routing?pageSize=20&page=2"); });
  it("never turns a missing existing department into a global scope", async () => {
    departments = departments.filter(row => row.id !== department.id); await editor(); await toggle(); expect(select("departmentId").value).toBe(department.id); expect(select("departmentId").selectedOptions[0].textContent).toContain("область сохранена");
    await submit(); expect(mocks.write).not.toHaveBeenCalled(); expect(container.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(true);
  });
  it("allows a global scope only after explicit selection", async () => {
    departments = departments.filter(row => row.id !== department.id); await editor(); await change("departmentId", ""); await submit(); expect(mocks.write).toHaveBeenCalledWith("routing/rule", { departmentId: null }, "PATCH");
  });
  it("preserves every original identifier through missing lookups and retry", async () => {
    categories = []; users = []; departments = []; await editor(); await toggle();
    expect(select("categoryId").value).toBe(category.id); expect(select("departmentId").value).toBe(department.id); expect(select("assigneeId").value).toBe(manager.id); await submit(); expect(mocks.write).not.toHaveBeenCalled();
    categories = [category]; users = [manager]; departments = [department]; await editor(); await submit(); expect(mocks.write).toHaveBeenCalledWith("routing/rule", { isActive: false }, "PATCH");
  });
  it("omits unchanged links and preserves an existing global rule", async () => {
    rule = { ...rule, departmentId: null, department: null }; await editor(); await toggle(); await submit(); expect(select("departmentId").value).toBe(""); expect(mocks.write).toHaveBeenCalledWith("routing/rule", { isActive: false }, "PATCH");
  });
  it("sends only an explicitly changed category without changing the scope", async () => {
    categories.push({ ...category, id: "new-category", name: "Другая" }); await editor(); await change("categoryId", "new-category"); await submit(); expect(mocks.write).toHaveBeenCalledWith("routing/rule", { categoryId: "new-category" }, "PATCH");
  });
  it("creates a valid rule using the existing payload", async () => {
    await editor(null); await change("categoryId", category.id); await change("departmentId", department.id); await change("assigneeId", manager.id); await submit(); expect(mocks.write).toHaveBeenCalledWith("routing", { categoryId: category.id, departmentId: department.id, assigneeId: manager.id, isActive: true }, "POST");
  });
  it.each(["categories", "departments", "users"])("blocks saving and retries %s after an error", async name => {
    modes[name] = "error"; await editor(); await toggle(); await submit(); expect(mocks.write).not.toHaveBeenCalled(); await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledWith(name);
    modes[name] = "ready"; await editor(); expect(select("departmentId").value).toBe(department.id); await submit(); expect(mocks.write).toHaveBeenCalledWith("routing/rule", { isActive: false }, "PATCH");
  });
  it("labels incomplete lookups and blocks pending loads", async () => {
    await editor(); expect(container.textContent).toContain("Список неполный"); modes.departments = "loading"; await editor(); await toggle(); await submit(); expect(mocks.write).not.toHaveBeenCalled(); expect(container.textContent).toContain("Сохранение заблокировано");
  });
  it.each(["category", "department", "user", "user-department"])("blocks activation for inactive %s", async kind => {
    rule = { ...rule, isActive: false };
    if (kind === "category") categories[0].isActive = false;
    if (kind === "department") departments[0].isActive = false;
    if (kind === "user") users[0].isActive = false;
    if (kind === "user-department") departments[1].isActive = false;
    await editor(); await toggle(); await submit(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("explains the existing server restriction for a demoted assignee", async () => { users[0].role = "EMPLOYEE"; await editor(); await toggle(); await submit(); expect(mocks.write).not.toHaveBeenCalled(); expect(select("assigneeId").value).toBe(manager.id); expect(container.textContent).toContain("даже для отключённого правила"); });
  it("handles 409 without clearing selected IDs", async () => { await editor(); await toggle(); mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "CONFLICT", "Конфликт")); await submit(); expect(container.querySelector("#routing-departmentId-error")?.textContent).toContain("уже существует активное правило"); expect(select("departmentId").value).toBe(department.id); expect(select("categoryId").value).toBe(category.id); expect(select("assigneeId").value).toBe(manager.id); });
  it("preserves selection and refreshes lookups after INVALID_ROUTING", async () => { await editor(); await toggle(); mocks.write.mockRejectedValueOnce(new ApiRequestError(422, "INVALID_ROUTING", "Связи недоступны")); await submit(); expect(select("departmentId").value).toBe(department.id); expect(mocks.refresh.mock.calls.map(row => row[0])).toEqual(["categories", "departments", "users"]); });
  it("blocks duplicate submissions while pending", async () => { let finish!: (value: unknown) => void; mocks.write.mockReturnValue(new Promise(resolve => { finish = resolve; })); await editor(); await toggle(); await submit(); await submit(); expect(mocks.write).toHaveBeenCalledOnce(); await act(async () => finish({})); });
  it("keeps accessible labels and cancellation", async () => { await editor(); expect(select("categoryId").labels?.[0].textContent).toContain("Категория"); select("departmentId").focus(); expect(document.activeElement).toBe(select("departmentId")); await act(async () => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }))); expect(mocks.close).toHaveBeenCalledOnce(); });
});
