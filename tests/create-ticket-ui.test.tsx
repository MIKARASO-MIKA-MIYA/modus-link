// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTicket } from "@/components/create-ticket";
import { ApiRequestError } from "@/lib/client-api";

const mocks = vi.hoisted(() => ({ mode: "ready", refresh: vi.fn(), push: vi.fn(), write: vi.fn(), api: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write, api: mocks.api }));
vi.mock("@/components/use-resource", () => ({ useResource: () => ({
  data: mocks.mode === "error" || mocks.mode === "loading" ? null : { items: mocks.mode === "empty" ? [] : [{ id: "category", name: "Рабочие процессы", isActive: true }] },
  loading: mocks.mode === "loading", error: mocks.mode === "error" ? "Категории недоступны" : null, refresh: mocks.refresh,
}) }));
let container: HTMLDivElement, root: Root;
const ticket = { id: "created", number: "MP-00000021", version: 1 };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.mode = "ready"; mocks.refresh.mockReset(); mocks.push.mockReset(); mocks.write.mockReset(); mocks.api.mockReset();
  mocks.write.mockResolvedValue(ticket); mocks.api.mockResolvedValue({ ticket: { ...ticket, version: 2 }, attachment: { id: "file" } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
async function mount() { await act(async () => root.render(<CreateTicket />)); }
function field(name: string) { return container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`)!; }
function fill(title = "Тестовая тема", description = "Подробное описание обращения") { field("categoryId").value = "category"; field("title").value = title; field("description").value = description; }
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
async function pick(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
function file(name = "example.pdf") { return new File(["test"], name, { type: "application/pdf" }); }

for (const theme of ["light", "dark"]) describe(`${theme} create form behavior (DOM tests, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each([[2, 10, false], [3, 10, true], [200, 10000, true], [201, 10, false], [3, 9, false], [3, 10001, false]])("validates title %i / description %i", async (title, description, valid) => {
    await mount(); fill("a".repeat(title), "b".repeat(description)); await submit();
    expect(mocks.write.mock.calls.length).toBe(valid ? 1 : 0);
    if (!valid) { expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull(); expect(document.activeElement).toBe(field(title < 3 || title > 200 ? "title" : "description")); }
  });
  it("validates required category and trimmed text without clearing input", async () => {
    await mount(); fill("   ", "          "); field("categoryId").value = ""; await submit();
    expect(mocks.write).not.toHaveBeenCalled();
    for (const name of ["categoryId", "title", "description"]) { expect(field(name).getAttribute("aria-invalid")).toBe("true"); expect(container.querySelector(`#${name}-error`)?.getAttribute("role")).toBe("alert"); }
    expect(field("title").value).toBe("   "); expect(document.activeElement).toBe(field("categoryId"));
  });
  it("sends chosen type, category, priority and text to the existing API", async () => {
    await mount(); fill("  Тема обращения  ");
    await act(async () => { container.querySelector<HTMLInputElement>('[name="type"][value="SUGGESTION"]')!.click(); container.querySelector<HTMLInputElement>('[name="priority"][value="HIGH"]')!.click(); });
    await submit();
    expect(mocks.write).toHaveBeenCalledWith("tickets", { title: "Тема обращения", description: "Подробное описание обращения", categoryId: "category", type: "SUGGESTION", priority: "HIGH" });
    expect(mocks.push).toHaveBeenCalledWith("/tickets/created");
  });
  it.each(["loading", "empty", "error"])("handles %s categories without submitting", async mode => {
    mocks.mode = mode; await mount();
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(field("categoryId").disabled).toBe(true);
    if (mode === "error" || mode === "empty") {
      const retry = [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent === (mode === "error" ? "Повторить" : "Обновить категории"))!;
      await act(async () => retry.click()); expect(mocks.refresh).toHaveBeenCalledOnce(); expect(mocks.write).not.toHaveBeenCalled();
      mocks.mode = "ready"; await mount(); fill(); await submit(); expect(mocks.write).toHaveBeenCalledOnce();
    }
  });
  it("keeps text and maps API field errors, then recovers", async () => {
    await mount(); fill();
    mocks.write.mockRejectedValueOnce(new ApiRequestError(422, "VALIDATION_ERROR", "Проверьте поля", [{ path: "title", message: "Ошибка темы" }]));
    await submit(); expect(field("title").value).toBe("Тестовая тема"); expect(container.querySelector("#title-error")?.textContent).toBe("Ошибка темы"); expect(mocks.push).not.toHaveBeenCalled();
    expect(field("title").getAttribute("aria-describedby")).toContain("title-error");
    await submit(); expect(mocks.push).toHaveBeenCalledWith("/tickets/created");
  });
  it("recovers from a network error without losing text", async () => {
    await mount(); fill(); mocks.write.mockRejectedValueOnce(new TypeError("Нет подключения"));
    await submit(); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Нет подключения"); expect(field("description").value).toBe("Подробное описание обращения");
    await submit(); expect(mocks.push).toHaveBeenCalledWith("/tickets/created");
  });
  it("blocks duplicate submits while the request is pending", async () => {
    let finish!: (value: typeof ticket) => void;
    mocks.write.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await mount(); fill(); await submit(); await submit();
    expect(mocks.write).toHaveBeenCalledOnce(); expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    await act(async () => finish(ticket)); expect(mocks.push).toHaveBeenCalledOnce();
  });
  it("retries only remaining attachments without creating another ticket", async () => {
    await mount(); fill(); await pick([file("one.pdf"), file("two.pdf")]);
    mocks.api.mockResolvedValueOnce({ ticket: { ...ticket, version: 2 }, attachment: { id: "one" } }).mockRejectedValueOnce(new Error("Сбой загрузки"));
    await submit(); expect(mocks.write).toHaveBeenCalledOnce(); expect(mocks.push).not.toHaveBeenCalled();
    expect(container.textContent).toContain("MP-00000021"); expect(container.textContent).toContain("Повторить загрузку файлов");
    expect(container.querySelectorAll(".selected-files li")).toHaveLength(1); expect(field("title").disabled).toBe(true);
    expect((mocks.api.mock.calls[1][1].body as FormData).get("version")).toBe("2");
    await submit(); expect(mocks.write).toHaveBeenCalledOnce(); expect(mocks.api).toHaveBeenCalledTimes(3);
    expect((mocks.api.mock.calls[2][1].body as FormData).get("file")).toMatchObject({ name: "two.pdf" });
    expect(mocks.push).toHaveBeenCalledWith("/tickets/created");
  });
  it("supports drag and drop and removing a selected file", async () => {
    await mount(); const drop = new Event("drop", { bubbles: true, cancelable: true }); Object.defineProperty(drop, "dataTransfer", { value: { files: [file()] } });
    await act(async () => container.querySelector(".dropzone")!.dispatchEvent(drop));
    expect(container.querySelectorAll(".selected-files li")).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Убрать example.pdf"]')!.click());
    expect(container.querySelector(".selected-files")).toBeNull(); expect(container.textContent).toContain("Не больше 10 файлов");
  });
  it.each(["extension", "empty", "size", "count"])("rejects invalid files: %s", async kind => {
    await mount();
    await pick(kind === "count" ? Array.from({ length: 11 }, () => file()) : [kind === "extension" ? file("test.exe") : kind === "empty" ? new File([], "empty.pdf") : new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf")]);
    expect(container.querySelector(".file-picker [role=alert]")).not.toBeNull(); expect(container.querySelector(".selected-files")).toBeNull();
  });
  it("keeps labels, legends and keyboard focus targets", async () => {
    await mount();
    expect(field("title").labels?.[0].textContent).toContain("Тема"); expect(field("description").labels?.[0].textContent).toContain("Описание");
    expect(container.querySelectorAll("fieldset legend")).toHaveLength(2);
    const radio = container.querySelector<HTMLInputElement>('[name="type"]')!; radio.focus(); expect(document.activeElement).toBe(radio);
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]')!; picker.focus(); expect(document.activeElement).toBe(picker);
  });
});
