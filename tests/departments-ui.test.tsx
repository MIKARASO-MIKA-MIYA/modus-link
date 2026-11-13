// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDirectory } from "@/components/admin-directory";
import { ApiRequestError } from "@/lib/client-api";
const mocks = vi.hoisted(() => ({ role: "ADMIN", company: false, mode: "ready", urls: [] as (string | null)[], refresh: vi.fn(), write: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor: { id: "actor", role: mocks.role, canViewCompanyAnalytics: mocks.company } }) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  mocks.urls.push(url);
  return { data: !url || mocks.mode === "error" || mocks.mode === "loading" ? null : { items: mocks.mode === "empty" ? [] : [{ id: "department", name: "Подразделение", isActive: true }], pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }, loading: !!url && mocks.mode === "loading", error: !!url && mocks.mode === "error" ? "Подразделения недоступны" : null, refresh: mocks.refresh };
} }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.role = "ADMIN"; mocks.company = false; mocks.mode = "ready"; mocks.urls = []; mocks.refresh.mockReset(); mocks.write.mockReset().mockResolvedValue({});
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } }, close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });
async function mount() { await act(async () => root.render(<AdminDirectory kind="departments" />)); }
async function click(text: string) { const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent?.trim() === text)!; expect(button, text).toBeTruthy(); await act(async () => button.click()); }
async function edit() { await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Изменить Подразделение"]')!.click()); }
function input(name: string) { return container.querySelector<HTMLInputElement>(`dialog [name="${name}"]`)!; }
async function submit() { await act(async () => container.querySelector("dialog form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
for (const theme of ["light", "dark"]) describe(`${theme} departments behavior (DOM fixtures, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER"])("denies management for %s even with company analytics", async role => {
    mocks.role = role; mocks.company = true; await mount(); expect(container.textContent).toContain("Нет доступа"); expect(container.querySelector("button")).toBeNull(); expect(mocks.urls.filter(Boolean)).toEqual([]);
  });
  it("keeps the paged list without a second 100-record request", async () => {
    await mount(); expect(container.querySelector("h1")?.textContent).toBe("Подразделения"); expect(mocks.urls.filter(Boolean)).toEqual(["departments?pageSize=20&page=1"]); expect(container.textContent).toContain("активными сотрудниками нельзя деактивировать");
    await click("Далее"); expect(mocks.urls).toContain("departments?pageSize=20&page=2"); await click("Назад"); expect(mocks.urls.filter(Boolean).at(-1)).toBe("departments?pageSize=20&page=1");
  });
  it.each(["loading", "error", "empty"])("renders the %s state and safe retry", async mode => {
    mocks.mode = mode; await mount(); expect(container.querySelector(".data-table")).toBeNull(); expect(container.querySelector(mode === "loading" ? ".loading-state" : mode === "error" ? '[role="alert"]' : ".empty-state")).not.toBeNull();
    if (mode === "error") { expect(container.querySelector(".empty-state")).toBeNull(); await click("Повторить"); expect(mocks.refresh).toHaveBeenCalledOnce(); mocks.mode = "ready"; await mount(); expect(container.querySelector(".data-table")).not.toBeNull(); }
  });
  it("creates with the existing fields and trimmed name", async () => {
    await mount(); await click("Добавить подразделение"); input("name").value = " Новый отдел "; await submit(); expect(mocks.write).toHaveBeenCalledWith("departments", { name: "Новый отдел", isActive: true }, "POST"); expect(container.querySelector("dialog")).toBeNull();
  });
  it("edits and deactivates through the existing PATCH", async () => {
    await mount(); await edit(); input("name").value = "Новое название"; input("isActive").checked = false; await submit(); expect(mocks.write).toHaveBeenCalledWith("departments/department", { name: "Новое название", isActive: false }, "PATCH"); expect(container.textContent).not.toContain("Удалить");
  });
  it.each([[1, false], [2, true], [120, true], [121, false], [0, false]])("validates name length %i", async (length, valid) => {
    await mount(); await click("Добавить подразделение"); input("name").value = "a".repeat(length); await submit(); expect(mocks.write.mock.calls.length).toBe(valid ? 1 : 0);
    if (!valid) { expect(input("name").getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(input("name")); }
  });
  it("keeps values and associates HAS_ACTIVE_USERS with activity", async () => {
    await mount(); await edit(); input("name").value = "Сохранённое имя"; input("isActive").checked = false;
    mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "HAS_ACTIVE_USERS", "Сначала переведите сотрудников")); await submit();
    expect(input("name").value).toBe("Сохранённое имя"); expect(input("isActive").checked).toBe(false); expect(input("isActive").getAttribute("aria-describedby")).toBe("department-isActive-error"); expect(container.querySelector("#department-isActive-error")?.textContent).toContain("активными сотрудниками"); expect(document.activeElement).toBe(input("isActive"));
    await submit(); expect(container.querySelector("dialog")).toBeNull();
  });
  it("maps validation errors and duplicate-name conflicts without clearing values", async () => {
    await mount(); await edit(); mocks.write.mockRejectedValueOnce(new ApiRequestError(422, "VALIDATION_ERROR", "Проверьте поля", [{ path: "name", message: "Ошибка названия" }])); await submit(); expect(container.querySelector("#department-name-error")?.textContent).toBe("Ошибка названия");
    mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "CONFLICT", "Конфликт")); await submit(); expect(container.querySelector("#department-name-error")?.textContent).toContain("уже существует"); expect(input("name").value).toBe("Подразделение");
  });
  it("retains input after network failure", async () => {
    await mount(); await edit(); mocks.write.mockRejectedValueOnce(new Error("Нет подключения")); await submit(); expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain("Нет подключения"); expect(input("name").value).toBe("Подразделение");
  });
  it("blocks duplicate submissions while pending", async () => {
    let finish!: (value: unknown) => void; mocks.write.mockReturnValue(new Promise(resolve => { finish = resolve; })); await mount(); await edit(); await submit(); await submit(); expect(mocks.write).toHaveBeenCalledOnce(); expect(container.querySelector<HTMLButtonElement>('dialog .button-primary')?.disabled).toBe(true); await act(async () => finish({}));
  });
  it("keeps labelled focus targets and cancellation", async () => {
    await mount(); await edit(); expect(input("name").labels?.[0].textContent).toContain("Название"); input("name").focus(); expect(document.activeElement).toBe(input("name")); await act(async () => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }))); expect(container.querySelector("dialog")).toBeNull();
  });
});
