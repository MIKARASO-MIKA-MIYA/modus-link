// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketDetail } from "@/components/ticket-detail";
import { ApiRequestError } from "@/lib/client-api";
import { canManage, ticketScope } from "@/server/permissions";
import type { Actor, TicketDto } from "@/types/api";

const mocks = vi.hoisted(() => ({ modes: {} as Record<string, string>, urls: [] as string[], refresh: vi.fn(), write: vi.fn(), api: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor }) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write, api: mocks.api }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  const kind = !url ? "none" : url.startsWith("users") ? "users" : url.includes("/comments") ? "comments" : url.includes("/history") ? "history" : url.includes("/attachments") ? "attachments" : "ticket";
  if (url) mocks.urls.push(url);
  const mode = mocks.modes[kind] ?? "ready";
  let data: unknown = null;
  if (mode === "ready" || mode === "empty") {
    const items = mode === "empty" ? [] : kind === "comments" ? [{ id: "comment", authorId: "author", author: { name: "Автор" }, content: "Комментарий из API", visibility: "PUBLIC", createdAt: ticket.createdAt }] : kind === "history" ? [{ id: "history", action: "CREATED", actor: { name: "Автор" }, createdAt: ticket.createdAt, newValue: {}, visibility: "PUBLIC" }] : kind === "attachments" ? [{ id: "file", filename: "Очень-длинное-имя-файла.pdf", size: 1024, createdAt: ticket.createdAt }] : [{ id: "manager", name: "Руководитель", role: "MANAGER" }];
    const page = Number(new URLSearchParams(url?.split("?")[1]).get("page") ?? 1);
    data = kind === "ticket" ? mode === "empty" ? null : ticket : kind === "attachments" ? { items } : { items, pagination: { page, pageSize: 50, total: items.length ? 101 : 0, totalPages: items.length ? 3 : 0 } };
  }
  return { data, loading: mode === "loading", error: mode === "error" ? `Ошибка: ${kind}` : null, refresh: () => mocks.refresh(kind) };
} }));
const employee: Actor = { id: "author", username: "author", name: "Автор", email: null, role: "EMPLOYEE", departmentId: "department", canViewCompanyAnalytics: false };
let actor: Actor, ticket: TicketDto, container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  actor = { ...employee };
  ticket = { id: "ticket", number: "MP-00000001", title: "Обращение с длинной темой", description: "Описание обращения\nВторая строка", status: "UNDER_REVIEW", type: "PROBLEM", priority: "HIGH", authorId: employee.id, departmentId: "department", categoryId: "category", assigneeId: "manager", author: employee, assignee: { ...employee, id: "manager", role: "MANAGER" }, category: { id: "category", name: "Категория", description: null, isActive: true }, department: { id: "department", name: "Подразделение", isActive: true }, version: 1, dueAt: "2099-01-01T00:00:00Z", createdAt: "2026-11-12T10:00:00Z", updatedAt: "2026-11-12T10:00:00Z", archivedAt: null, closedAt: null, resolution: null, outcome: null, firstRespondedAt: null, sequence: 1, isSynthetic: true, sourceAuthorRole: null, sourceAssigneeRole: null };
  mocks.modes = {}; mocks.urls = []; mocks.refresh.mockReset(); mocks.write.mockReset(); mocks.api.mockReset();
  mocks.write.mockImplementation(async (path: string) => path.endsWith("/comments") ? { ticket: { ...ticket, version: 2 } } : { ...ticket, version: 2 });
  mocks.api.mockResolvedValue({ ticket: { ...ticket, version: 2 }, attachment: { id: "file" } });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } },
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });
async function mount() { await act(async () => root.render(<TicketDetail id="ticket" />)); }
async function click(text: string) { const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent?.trim() === text)!; expect(button, text).toBeTruthy(); await act(async () => button.click()); }
async function tab(name: string) { await act(async () => container.querySelector<HTMLButtonElement>(`#ticket-tab-${name}`)!.click()); }
async function enter(selector: string, text: string) { const input = container.querySelector<HTMLTextAreaElement>(selector)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit(selector: string) { await act(async () => container.querySelector(selector)!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

for (const theme of ["light", "dark"]) describe(`${theme} detail behavior (DOM tests; not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("keeps actions and server self-handling prohibition for %s", async role => {
    actor = { ...employee, role }; await mount();
    expect(container.textContent).toContain(ticket.number); expect(container.querySelector(".ticket-description")?.textContent).toBe(ticket.description);
    expect(container.querySelector(".ticket-actions")).toBeNull(); expect(container.querySelector(".property-edit")).toBeNull();
    expect(container.querySelector(".composer-actions .checkbox")).toBeNull(); expect(canManage(actor, ticket)).toBe(false);
  });
  it.each(["MANAGER", "ADMIN"] as const)("allows the eligible %s to manage another author's ticket", async role => {
    actor = { ...employee, id: "manager", role }; await mount();
    expect(container.querySelector(".ticket-actions")).not.toBeNull(); expect(container.querySelector('[aria-label="Изменить срок"]')).not.toBeNull(); expect(container.querySelector(".composer-actions .checkbox")).not.toBeNull(); expect(canManage(actor, ticket)).toBe(true);
    expect(ticketScope({ ...employee, role: "EMPLOYEE" })).toEqual({ authorId: employee.id });
  });
  it("restricts unassigned managers outside the department but allows assigned handling", async () => {
    actor = { ...employee, id: "other", role: "MANAGER", departmentId: "other" }; await mount(); expect(container.querySelector(".ticket-actions")).toBeNull(); expect(canManage(actor, ticket)).toBe(false);
    actor = { ...actor, id: "manager" }; await mount(); expect(container.querySelector(".ticket-actions")).not.toBeNull(); expect(container.querySelector('[aria-label="Изменить ответственного"]')).toBeNull();
  });
  it("lets an author edit only a new ticket", async () => {
    ticket = { ...ticket, status: "NEW" }; await mount(); await click("Изменить");
    expect(container.querySelector('dialog [name="title"]')).not.toBeNull(); expect(container.querySelector('dialog [name="priority"]')).toBeNull();
  });
  it.each(["loading", "error", "empty"])("renders the ticket %s state", async mode => {
    mocks.modes.ticket = mode; await mount(); expect(container.querySelector(".ticket-detail-grid")).toBeNull();
    expect(container.querySelector(mode === "loading" ? ".loading-state" : mode === "error" ? '[role="alert"]' : ".empty-state")).not.toBeNull();
  });
  it.each(["comments", "history", "attachments"])("separates loading, failure and empty states for %s", async kind => {
    mocks.modes[kind] = "loading"; await mount(); await tab(kind);
    expect(container.querySelector('[role="tabpanel"] .loading-state')).not.toBeNull(); expect(container.querySelector('[role="tabpanel"] .empty-state')).toBeNull();
    mocks.modes[kind] = "error"; await mount();
    expect(container.querySelector('[role="tabpanel"] [role="alert"]')?.textContent).toContain(`Ошибка: ${kind}`); expect(container.querySelector('[role="tabpanel"] .empty-state')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[role="tabpanel"] [role="alert"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledWith(kind);
    mocks.modes[kind] = "empty"; await mount(); expect(container.querySelector('[role="tabpanel"] .empty-state')).not.toBeNull();
  });
  it("supports arrow, Home and End keys and a single tab stop", async () => {
    await mount(); const first = container.querySelector<HTMLButtonElement>("#ticket-tab-comments")!;
    await act(async () => first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
    expect(document.activeElement?.id).toBe("ticket-tab-history"); expect(container.querySelector('[role="tabpanel"]')?.id).toBe("ticket-panel-history");
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect(document.activeElement?.id).toBe("ticket-tab-attachments");
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement?.id).toBe("ticket-tab-comments"); expect(container.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(document.activeElement?.id).toBe("ticket-tab-attachments");
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(document.activeElement?.id).toBe("ticket-tab-comments");
  });
  it("labels history as a page fragment and preserves pagination", async () => {
    await mount(); expect(container.querySelector(".history-summary")?.textContent).toContain("Это фрагмент доступной истории");
    await click("Открыть историю"); expect(document.activeElement?.id).toBe("ticket-tab-history");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tabpanel"] button')].find(n => n.textContent === "Далее")!.click());
    expect(mocks.urls).toContain("tickets/ticket/history?pageSize=50&page=2"); expect(container.querySelector(".history-summary")?.textContent).toContain("страницы 2");
  });
  it("retains comment text after version conflict and retries using the refreshed version", async () => {
    ticket = { ...ticket, status: "NEEDS_CLARIFICATION" }; await mount(); await enter("#ticket-comment", "Уточнение автора");
    mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "VERSION_CONFLICT", "Обновите данные")); await submit(".comment-composer form");
    expect(container.querySelector<HTMLTextAreaElement>("#ticket-comment")?.value).toBe("Уточнение автора"); expect(mocks.refresh).toHaveBeenCalledWith("ticket");
    ticket = { ...ticket, version: 3 }; await mount(); await submit(".comment-composer form");
    expect(mocks.write).toHaveBeenLastCalledWith("tickets/ticket/comments", { version: 3, content: "Уточнение автора", visibility: "PUBLIC" }); expect(container.querySelector<HTMLTextAreaElement>("#ticket-comment")?.value).toBe("");
  });
  it("sends internal notes only through the available handler control", async () => {
    actor = { ...employee, id: "manager", role: "MANAGER" }; await mount(); await enter("#ticket-comment", "Служебная заметка");
    await act(async () => container.querySelector<HTMLInputElement>('.composer-actions input[type="checkbox"]')!.click()); await submit(".comment-composer form");
    expect(mocks.write).toHaveBeenLastCalledWith("tickets/ticket/comments", expect.objectContaining({ visibility: "INTERNAL" }));
  });
  it("preserves authenticated attachment links and upload action", async () => {
    await mount(); await tab("attachments"); expect(container.querySelector(".attachment-row")?.getAttribute("href")).toBe("/api/v1/tickets/ticket/attachments/file"); await click("Добавить вложения"); expect(container.querySelector('dialog input[type="file"]')).not.toBeNull();
  });
  it("preserves clarification requests through the status dialog", async () => {
    actor = { ...employee, id: "manager", role: "MANAGER" }; await mount(); await click("Изменить статус");
    const select = container.querySelector<HTMLSelectElement>("dialog select")!;
    await act(async () => { select.value = "NEEDS_CLARIFICATION"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    container.querySelector<HTMLTextAreaElement>('dialog [name="message"]')!.value = "Уточните местоположение";
    await submit("dialog form"); expect(mocks.write).toHaveBeenCalledWith("tickets/ticket/status", { version: 1, status: "NEEDS_CLARIFICATION", message: "Уточните местоположение" });
    expect(container.querySelector("dialog")).toBeNull();
  });
  it("preserves assignment and required reason", async () => {
    actor = { ...employee, id: "manager", role: "MANAGER" }; await mount(); await click("Назначить ответственного");
    container.querySelector<HTMLSelectElement>('dialog [name="assigneeId"]')!.value = "manager";
    container.querySelector<HTMLTextAreaElement>('dialog [name="reason"]')!.value = "Обрабатывает отдел";
    await submit("dialog form"); expect(mocks.write).toHaveBeenCalledWith("tickets/ticket/assign", { version: 1, assigneeId: "manager", reason: "Обрабатывает отдел" });
  });
  it("blocks assignment on user-load failure and allows safe retry", async () => {
    actor = { ...employee, id: "admin", role: "ADMIN" }; mocks.modes.users = "error"; await mount(); await click("Назначить ответственного");
    expect(container.querySelector<HTMLButtonElement>('dialog button[type="submit"]')?.disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('dialog [role="alert"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledWith("users"); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("preserves deadline changes in UTC+5", async () => {
    actor = { ...employee, id: "manager", role: "MANAGER" }; await mount();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Изменить срок"]')!.click());
    container.querySelector<HTMLInputElement>('dialog [name="due"]')!.value = "2026-12-01T15:00";
    await submit("dialog form"); expect(mocks.write).toHaveBeenCalledWith("tickets/ticket", { version: 1, dueAt: "2026-12-01T10:00:00.000Z" }, "PATCH");
  });
  it("preserves edit text after a conflict and retries the refreshed version", async () => {
    actor = { ...employee, id: "manager", role: "MANAGER" }; await mount(); await click("Изменить");
    container.querySelector<HTMLInputElement>('dialog [name="title"]')!.value = "Исправленная тема";
    mocks.write.mockRejectedValueOnce(new ApiRequestError(409, "VERSION_CONFLICT", "Обновите карточку")); await submit("dialog form");
    expect(container.querySelector<HTMLInputElement>('dialog [name="title"]')?.value).toBe("Исправленная тема"); expect(mocks.refresh).toHaveBeenCalledWith("ticket");
    ticket = { ...ticket, version: 3 }; await mount(); await submit("dialog form");
    expect(mocks.write).toHaveBeenLastCalledWith("tickets/ticket", expect.objectContaining({ version: 3, title: "Исправленная тема" }), "PATCH");
  });
  it("retains a failed resolution and saves it on retry", async () => {
    actor = { ...employee, id: "manager", role: "MANAGER" }; await mount(); await enter("#resolution-text", "Итоговое решение" );
    mocks.write.mockRejectedValueOnce(new Error("Сбой сохранения")); await submit(".resolution-panel form");
    expect(container.querySelector<HTMLTextAreaElement>("#resolution-text")?.value).toBe("Итоговое решение");
    await submit(".resolution-panel form"); expect(mocks.write).toHaveBeenLastCalledWith("tickets/ticket/status", { version: 1, status: "IMPLEMENTED", resolution: "Итоговое решение" });
  });
  it("prevents duplicate comments while pending", async () => {
    let finish!: (value: { ticket: TicketDto }) => void;
    mocks.write.mockReturnValue(new Promise(resolve => { finish = resolve; })); await mount(); await enter("#ticket-comment", "Мой комментарий");
    await submit(".comment-composer form"); await submit(".comment-composer form"); expect(mocks.write).toHaveBeenCalledOnce();
    await act(async () => finish({ ticket: { ...ticket, version: 2 } }));
  });
  it("preserves archive/restore with a required reason and hides changes while archived", async () => {
    actor = { ...employee, id: "admin", role: "ADMIN" }; ticket = { ...ticket, status: "CLOSED", resolution: "Решение", archivedAt: "2026-11-13T00:00:00Z" }; await mount();
    expect(container.querySelector(".comment-composer")).toBeNull(); expect(container.querySelector(".ticket-actions")).toBeNull(); await click("Восстановить из архива");
    container.querySelector<HTMLTextAreaElement>('dialog [name="reason"]')!.value = "Повторная проверка"; await submit("dialog form");
    expect(mocks.write).toHaveBeenCalledWith("tickets/ticket/archive", { version: 1, archived: false, reason: "Повторная проверка" });
  });
  it("retries an attachment conflict with the refreshed ticket version", async () => {
    await mount(); await tab("attachments"); await click("Добавить вложения");
    const input = container.querySelector<HTMLInputElement>('dialog input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["test"], "retry.pdf", { type: "application/pdf" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    mocks.api.mockRejectedValueOnce(new ApiRequestError(409, "VERSION_CONFLICT", "Обновите данные"));
    await submit("dialog form"); expect(container.querySelectorAll("dialog .selected-files li")).toHaveLength(1); expect(mocks.refresh).toHaveBeenCalledWith("ticket");
    ticket = { ...ticket, version: 5 }; await mount(); await submit("dialog form");
    expect((mocks.api.mock.calls[1][1].body as FormData).get("version")).toBe("5"); expect(mocks.write).not.toHaveBeenCalled(); expect(container.querySelector("dialog")).toBeNull();
  });
});
