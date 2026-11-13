// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDirectory } from "@/components/admin-directory";
import { ApiRequestError } from "@/lib/client-api";
const mocks = vi.hoisted(() => ({ role: "ADMIN", mode: "ready", departmentMode: "ready", totalDepartments: 1, urls: [] as string[], refresh: vi.fn(), write: vi.fn() }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor: { id: "actor", role: mocks.role } }) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  if (url) mocks.urls.push(url);
  const department = url?.startsWith("departments"), mode = department ? mocks.departmentMode : mocks.mode;
  const items = mode === "empty" ? [] : department ? [{ id: "department", name: "Подразделение", isActive: true }] : mocks.role === "ADMIN" ? [self, user] : mocks.role === "EMPLOYEE" ? [self] : [user];
  return { data: !url || mode === "loading" || mode === "error" ? null : { items, pagination: { page: 1, pageSize: department ? 100 : 20, total: department ? mocks.totalDepartments : 40, totalPages: department ? 1 : 2 } }, loading: !!url && mode === "loading", error: !!url && mode === "error" ? department ? "Ошибка подразделений" : "Ошибка пользователей" : null, refresh: () => mocks.refresh(department ? "departments" : "users") };
} }));
const self = { id: "actor", name: "Моя запись", username: "self", email: null, role: "ADMIN", departmentId: "department", isActive: true, canViewCompanyAnalytics: false };
const user = { id: "other", name: "Другой сотрудник", username: "other", email: null, role: "EMPLOYEE", departmentId: "missing", isActive: false, canViewCompanyAnalytics: true };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.role = "ADMIN"; mocks.mode = "ready"; mocks.departmentMode = "ready"; mocks.totalDepartments = 1; mocks.urls = []; mocks.refresh.mockReset(); mocks.write.mockReset(); mocks.write.mockResolvedValue({});
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } }, close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });
async function mount() { await act(async () => root.render(<AdminDirectory kind="users" />)); }
async function click(text: string) { const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent?.trim() === text)!; expect(button, text).toBeTruthy(); await act(async () => button.click()); }
function input(name: string) { return container.querySelector<HTMLInputElement | HTMLSelectElement>(`dialog [name="${name}"]`)!; }
async function edit() { await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Изменить Другой сотрудник"]')!.click()); }
async function submit() { await act(async () => container.querySelector("dialog form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
for (const theme of ["light", "dark"]) describe(`${theme} team behavior (DOM fixtures, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER"])("hides management controls from %s", async role => {
    mocks.role = role; await mount(); expect(container.querySelectorAll(".directory-table tbody tr")).toHaveLength(1); expect(container.querySelector(".page-heading button")).toBeNull(); expect(container.querySelector(".directory-table button")).toBeNull(); expect(container.querySelector("dialog")).toBeNull();
    expect(container.textContent).toContain(role === "EMPLOYEE" ? "Доступна только ваша запись" : "активные сотрудники вашего подразделения");
  });
  it("separates activity and analytics and removes the self-edit action", async () => {
    await mount(); expect(container.textContent).toContain("Активность"); expect(container.textContent).toContain("Общая аналитика");
    expect(container.querySelectorAll(".team-activity")[1].textContent).toBe("Отключена"); expect(container.querySelectorAll(".team-permission")[1].textContent).toBe("Дополнительно разрешена");
    expect(container.querySelector('[aria-label="Изменить Моя запись"]')).toBeNull(); expect(container.textContent).toContain("Ваша запись"); expect(container.textContent).toContain("Название подразделения недоступно");
  });
  it("keeps server pagination at 20", async () => {
    await mount(); expect(mocks.urls).toContain("users?pageSize=20&page=1"); await click("Далее"); expect(mocks.urls).toContain("users?pageSize=20&page=2");
  });
  it.each(["EMPLOYEE", "MANAGER"])("gives a truthful empty state for %s", async role => {
    mocks.role = role; mocks.mode = "empty"; await mount(); expect(container.querySelector(".empty-state")).not.toBeNull(); expect(container.textContent).not.toContain("Добавьте первую запись");
  });
  it("shows loading without a false empty state", async () => {
    mocks.mode = "loading"; await mount(); expect(container.querySelector(".loading-state")).not.toBeNull(); expect(container.querySelector(".empty-state")).toBeNull();
  });
  it("retries both users and departments after errors", async () => {
    mocks.mode = "error"; mocks.departmentMode = "error"; await mount(); expect(container.querySelector(".empty-state")).toBeNull(); await click("Повторить"); expect(mocks.refresh).toHaveBeenCalledWith("users"); expect(mocks.refresh).toHaveBeenCalledWith("departments");
  });
  it("warns about incomplete department lists in the table and editor", async () => {
    mocks.totalDepartments = 150; await mount(); expect(container.textContent).toContain("загружено 1 из 150"); await edit(); expect(container.querySelector("dialog")?.textContent).toContain("Список неполный"); expect(input("departmentId").value).toBe("missing");
  });
  it("creates a user with existing role, department and analytics controls", async () => {
    await mount(); await click("Добавить пользователя"); input("name").value = "Новый сотрудник"; input("username").value = "new-user"; input("password").value = "secure-password"; input("departmentId").value = "department"; input("role").value = "MANAGER"; (input("canViewCompanyAnalytics") as HTMLInputElement).checked = true;
    await submit(); expect(mocks.write).toHaveBeenCalledWith("users", { name: "Новый сотрудник", username: "new-user", email: null, password: "secure-password", role: "MANAGER", departmentId: "department", canViewCompanyAnalytics: true }, "POST"); expect(container.querySelector("dialog")).toBeNull();
  });
  it("keeps an unavailable existing department unchanged on edit", async () => {
    await mount(); await edit(); input("name").value = "Новое имя"; await submit(); const [path, payload, method] = mocks.write.mock.calls[0]; expect(path).toBe("users/other"); expect(method).toBe("PATCH"); expect(payload).toMatchObject({ name: "Новое имя", isActive: false, canViewCompanyAnalytics: true }); expect(payload).not.toHaveProperty("departmentId"); expect(payload).not.toHaveProperty("password");
  });
  it("sends a deliberate department and role change", async () => {
    await mount(); await edit(); input("departmentId").value = "department"; input("role").value = "MANAGER"; await submit(); expect(mocks.write).toHaveBeenCalledWith("users/other", expect.objectContaining({ departmentId: "department", role: "MANAGER" }), "PATCH");
  });
  it("retains values and associates API errors with fields, then retries", async () => {
    await mount(); await edit(); input("username").value = "duplicate"; mocks.write.mockRejectedValueOnce(new ApiRequestError(422, "VALIDATION_ERROR", "Проверьте поля", [{ path: "username", message: "Ошибка ника" }]));
    await submit(); expect(input("username").value).toBe("duplicate"); expect(input("username").getAttribute("aria-invalid")).toBe("true"); expect(input("username").getAttribute("aria-describedby")).toBe("user-username-error"); expect(document.activeElement).toBe(input("username")); expect(container.querySelector("#user-username-error")?.textContent).toBe("Ошибка ника"); await submit(); expect(container.querySelector("dialog")).toBeNull();
  });
  it("retains input after server business-rule rejection", async () => {
    await mount(); await edit(); input("name").value = "Изменённое имя"; mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "HAS_ACTIVE_TICKETS", "Сначала переназначьте обращения")); await submit(); expect(input("name").value).toBe("Изменённое имя"); expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain("Сначала переназначьте");
  });
  it("blocks saves while departments fail and safely retries without submitting", async () => {
    await mount(); await edit(); mocks.departmentMode = "error"; await mount(); expect(container.querySelector<HTMLButtonElement>('dialog .button-primary')!.disabled).toBe(true); await act(async () => container.querySelector<HTMLButtonElement>('dialog [role="alert"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledWith("departments"); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("blocks creation without active departments", async () => {
    mocks.departmentMode = "empty"; await mount(); await click("Добавить пользователя"); expect(container.querySelector<HTMLButtonElement>('dialog .button-primary')!.disabled).toBe(true); expect(container.querySelector("dialog")?.textContent).toContain("Создание пользователя недоступно");
  });
  it("blocks duplicate saves while pending", async () => {
    let finish!: (value: unknown) => void; mocks.write.mockReturnValue(new Promise(resolve => { finish = resolve; })); await mount(); await edit(); await submit(); await submit(); expect(mocks.write).toHaveBeenCalledOnce(); expect(container.querySelector<HTMLButtonElement>('dialog .button-primary')!.disabled).toBe(true); await act(async () => finish({}));
  });
  it("preserves labelled, focusable fields and a cancellable dialog", async () => {
    await mount(); await edit(); expect(input("role").labels?.[0].textContent).toContain("Роль"); input("name").focus(); expect(document.activeElement).toBe(input("name"));
    await act(async () => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }))); expect(container.querySelector("dialog")).toBeNull();
  });
});
