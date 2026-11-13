// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDirectory } from "@/components/admin-directory";
import { ApiRequestError } from "@/lib/client-api";
const mocks = vi.hoisted(() => ({ role: "ADMIN", mode: "ready", urls: [] as (string | null)[], refresh: vi.fn(), write: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor: { id: "actor", role: mocks.role } }) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  mocks.urls.push(url);
  return { data: !url || mocks.mode === "error" || mocks.mode === "loading" ? null : { items: mocks.mode === "empty" ? [] : [category], pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }, loading: !!url && mocks.mode === "loading", error: !!url && mocks.mode === "error" ? "Категории недоступны" : null, refresh: mocks.refresh };
} }));
const category = { id: "category", name: "Рабочие процессы", description: "Описание категории", isActive: true };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.role = "ADMIN"; mocks.mode = "ready"; mocks.urls = []; mocks.refresh.mockReset(); mocks.write.mockReset().mockResolvedValue({});
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } }, close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });
async function mount() { await act(async () => root.render(<AdminDirectory kind="categories" />)); }
async function click(text: string) { const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent?.trim() === text)!; expect(button, text).toBeTruthy(); await act(async () => button.click()); }
async function edit() { await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Изменить Рабочие процессы"]')!.click()); }
function input(name: string) { return container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`dialog [name="${name}"]`)!; }
async function submit() { await act(async () => container.querySelector("dialog form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
for (const theme of ["light", "dark"]) describe(`${theme} categories behavior (DOM fixtures, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER"])("denies management to %s and sends no directory requests", async role => {
    mocks.role = role; await mount(); expect(container.textContent).toContain("Нет доступа"); expect(container.querySelector("button")).toBeNull(); expect(mocks.urls.filter(Boolean)).toEqual([]);
  });
  it("keeps 20-row pagination, category status and reference-only deadlines", async () => {
    await mount(); expect(container.querySelector("h1")?.textContent).toBe("Категории"); expect(container.querySelector(".directory-status")?.textContent).toBe("Активно"); expect(container.textContent).toContain("не редактируются на этой странице"); expect(mocks.urls).toContain("categories?pageSize=20&page=1"); expect(mocks.urls).not.toContain("departments?pageSize=100");
    await click("Далее"); expect(mocks.urls).toContain("categories?pageSize=20&page=2");
  });
  it.each(["loading", "error", "empty"])("separates %s from other states", async mode => {
    mocks.mode = mode; await mount(); expect(container.querySelector(".data-table")).toBeNull();
    expect(container.querySelector(mode === "loading" ? ".loading-state" : mode === "error" ? '[role="alert"]' : ".empty-state")).not.toBeNull();
    if (mode === "error") { expect(container.querySelector(".empty-state")).toBeNull(); await click("Повторить"); expect(mocks.refresh).toHaveBeenCalledOnce(); mocks.mode = "ready"; await mount(); expect(container.querySelector(".data-table")).not.toBeNull(); }
  });
  it("creates a category with trimmed text and existing fields only", async () => {
    await mount(); await click("Добавить категорию"); input("name").value = "  Новая категория  "; input("description").value = "  Описание  "; await submit();
    expect(mocks.write).toHaveBeenCalledWith("categories", { name: "Новая категория", description: "Описание", isActive: true }, "POST"); expect(container.querySelector("dialog")).toBeNull();
  });
  it("deactivates through PATCH without a deletion action", async () => {
    await mount(); await edit(); (input("isActive") as HTMLInputElement).checked = false; await submit(); expect(mocks.write).toHaveBeenCalledWith("categories/category", { name: category.name, description: category.description, isActive: false }, "PATCH"); expect(container.textContent).not.toContain("Удалить");
  });
  it.each([[1, 0, false], [2, 0, true], [120, 1000, true], [121, 0, false], [2, 1001, false]])("validates name %i and description %i", async (name, description, valid) => {
    await mount(); await click("Добавить категорию"); input("name").value = "a".repeat(name); input("description").value = "b".repeat(description); await submit(); expect(mocks.write.mock.calls.length).toBe(valid ? 1 : 0);
    if (!valid) { expect(container.querySelector('[role="alert"]')).not.toBeNull(); expect(document.activeElement).toBe(input(name === 1 || name === 121 ? "name" : "description")); }
    if (valid && !description) expect(mocks.write.mock.calls[0][1].description).toBeNull();
  });
  it("retains input on API field errors and retries", async () => {
    await mount(); await edit(); input("name").value = "Другая тема"; mocks.write.mockRejectedValueOnce(new ApiRequestError(422, "VALIDATION_ERROR", "Проверьте поля", [{ path: "name", message: "Название недопустимо" }])); await submit();
    expect(input("name").value).toBe("Другая тема"); expect(input("name").getAttribute("aria-invalid")).toBe("true"); expect(input("name").getAttribute("aria-describedby")).toBe("category-name-error"); expect(container.querySelector("#category-name-error")?.textContent).toBe("Название недопустимо"); await submit(); expect(container.querySelector("dialog")).toBeNull();
  });
  it("shows a duplicate-name conflict by its field", async () => {
    await mount(); await edit(); mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "CONFLICT", "Конфликт")); await submit(); expect(container.querySelector("#category-name-error")?.textContent).toContain("уже существует"); expect(input("description").value).toBe(category.description);
  });
  it("retains input on a network failure", async () => {
    await mount(); await edit(); mocks.write.mockRejectedValueOnce(new Error("Нет подключения")); await submit(); expect(container.querySelector('dialog [role="alert"]')?.textContent).toContain("Нет подключения"); expect(input("name").value).toBe(category.name);
  });
  it("blocks parallel duplicate saves", async () => {
    let finish!: (value: unknown) => void; mocks.write.mockReturnValue(new Promise(resolve => { finish = resolve; })); await mount(); await edit(); await submit(); await submit(); expect(mocks.write).toHaveBeenCalledOnce(); expect(container.querySelector<HTMLButtonElement>('dialog .button-primary')?.disabled).toBe(true); await act(async () => finish({}));
  });
  it("keeps labels and cancellation accessible", async () => {
    await mount(); await edit(); expect(input("name").labels?.[0].textContent).toContain("Название"); input("description").focus(); expect(document.activeElement).toBe(input("description")); await act(async () => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }))); expect(container.querySelector("dialog")).toBeNull();
  });
});
