// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketsScreen } from "@/components/tickets-screen";

const state = vi.hoisted(() => ({ role: "EMPLOYEE", params: "", mode: "ready", replace: vi.fn(), refresh: vi.fn(), urls: [] as (string | null)[] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }), useSearchParams: () => new URLSearchParams(state.params) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor: { id: "actor", role: state.role } }) }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  state.urls.push(url);
  if (!url) return { data: null, error: null, loading: false, refresh: state.refresh };
  if (state.mode === "error") return { data: null, error: "Ошибка загрузки", loading: false, refresh: state.refresh };
  if (state.mode === "loading") return { data: null, error: null, loading: true, refresh: state.refresh };
  const items = state.mode === "empty" ? [] : url.startsWith("tickets?") ? [ticket] : [{ id: "option", name: "Категория", role: "MANAGER" }];
  return { data: url === "analytics/overview" ? { total: 12, new: 3, inProgress: 4, needsClarification: 1, overdue: 2, completed: 4 } : { items, pagination: { page: 1, pageSize: 10, total: 21, totalPages: 3 } }, error: null, loading: false, refresh: state.refresh };
} }));
const ticket = { id: "ticket", number: "MP-00000001", title: "Проверить оборудование", category: { name: "Оборудование" }, author: { name: "Автор" }, assignee: null, status: "NEW", dueAt: "2099-01-01T12:00:00Z" };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.role = "EMPLOYEE"; state.params = ""; state.mode = "ready"; state.urls = []; state.replace.mockClear(); state.refresh.mockClear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => root.render(<TicketsScreen />)); }
async function change(element: HTMLSelectElement | HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); });
}
for (const theme of ["light", "dark"]) describe(`${theme} registry functionality (DOM tests, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER", "ADMIN"])("preserves %s permissions and all six API metrics", async role => {
    state.role = role; await mount();
    expect(container.querySelector("h1")?.textContent).toBe(role === "EMPLOYEE" ? "Мои обращения" : "Все обращения");
    expect([...container.querySelectorAll(".metric-body strong")].map(n => n.textContent)).toEqual(["12", "3", "4", "1", "2", "4"]);
    expect(container.querySelectorAll(".filter-control select")[3].hasAttribute("disabled")).toBe(role === "EMPLOYEE");
    expect(state.urls.includes("users?pageSize=100")).toBe(role !== "EMPLOYEE");
    expect(container.textContent?.includes("Только мои")).toBe(role !== "EMPLOYEE");
    expect(container.querySelector('[href="/tickets/ticket"]')).not.toBeNull();
    expect(container.querySelector('[href="/tickets/new"]')).not.toBeNull();
  });
  it("preserves URL filters while changing status, sorting, pagination and search", async () => {
    state.params = "categoryId=category&page=2&q=test"; await mount();
    await change(container.querySelector<HTMLSelectElement>(".filter-control select")!, "NEW");
    expect(state.replace).toHaveBeenLastCalledWith("/tickets?categoryId=category&q=test&status=NEW");
    await act(async () => container.querySelector<HTMLButtonElement>(".table-sort")!.click());
    expect(state.replace).toHaveBeenLastCalledWith("/tickets?categoryId=category&q=test&sortBy=number&order=desc");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Следующая страница"]')!.click());
    expect(state.replace).toHaveBeenLastCalledWith("/tickets?categoryId=category&page=2&q=test");
    await change(container.querySelector<HTMLSelectElement>(".pagination select")!, "50");
    expect(state.replace).toHaveBeenLastCalledWith("/tickets?categoryId=category&q=test&pageSize=50");
    const input = container.querySelector<HTMLInputElement>('.search-control input')!;
    input.value = " камера ";
    await act(async () => container.querySelector(".search-control")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(state.replace).toHaveBeenLastCalledWith(`/tickets?categoryId=category&q=${encodeURIComponent("камера")}`);
  });
  it("keeps selection, CSV export and clearing selection", async () => {
    await mount();
    const createUrl = vi.fn(() => "blob:registry-test"), revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await act(async () => container.querySelector<HTMLInputElement>('.registry-table input[type="checkbox"]')!.click());
    expect(container.querySelector(".selection-toolbar")?.textContent).toContain("Выбрано: 1");
    vi.useFakeTimers();
    await act(async () => container.querySelector<HTMLButtonElement>(".selection-toolbar button")!.click());
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob)); expect(click).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith("blob:registry-test"); vi.useRealTimers();
    await act(async () => container.querySelectorAll<HTMLButtonElement>(".selection-toolbar button")[1].click());
    expect(container.querySelector(".selection-toolbar")).toBeNull();
  });
  it("supports manager unassigned queue and reset for additional filters", async () => {
    state.role = "MANAGER"; state.params = "priority=HIGH&page=3&assigneeId=manager"; await mount();
    const checkbox = [...container.querySelectorAll<HTMLInputElement>('.filter-extras input[type="checkbox"]')].find(n => n.parentElement?.textContent?.includes("Без ответственного"))!;
    await act(async () => checkbox.click());
    expect(state.replace).toHaveBeenLastCalledWith("/tickets?priority=HIGH&unassigned=true");
    const reset = [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent === "Сбросить фильтры")!;
    await act(async () => reset.click()); expect(state.replace).toHaveBeenLastCalledWith("/tickets");
  });
  it.each(["loading", "empty", "error"])("renders the %s state without a fabricated table", async mode => {
    state.mode = mode; await mount();
    expect(container.querySelector(".registry-table")).toBeNull();
    expect(container.querySelector(mode === "loading" ? ".loading-state" : mode === "empty" ? ".empty-state" : '[role="alert"]')).not.toBeNull();
    if (mode === "error") {
      await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
      expect(state.refresh).toHaveBeenCalledTimes(5);
    }
  });
});
