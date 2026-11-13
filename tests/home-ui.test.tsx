// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, AnalyticsDto, Role } from "@/types/api";
import { HomeDashboard } from "@/components/home-dashboard";
import { HomeShell } from "@/components/home-shell";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), mode: "ready" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor }) }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => {
  if (mocks.mode === "error") return { data: null, loading: false, error: "Сервис временно недоступен", refresh: mocks.refresh };
  if (mocks.mode === "loading") return { data: null, loading: true, error: null, refresh: mocks.refresh };
  const empty = mocks.mode === "empty";
  return { data: !url ? null : url.startsWith("analytics/") ? empty ? { ...analytics, total: 0, completed: 0, byCategory: [], dailyTrend: [] } : analytics : { items: empty || actor.canViewCompanyAnalytics ? [] : recentTickets, pagination: { total: empty || actor.canViewCompanyAnalytics ? 0 : 3 } }, loading: false, error: null, refresh: mocks.refresh };
} }));
let actor: Actor;
const recentTickets = [1, 2, 3].map(index => ({
  id: `ticket-${index}`, number: `MP-0000000${index}`, title: `Обращение ${index} с подробной темой`,
  category: { name: "Межотдельное взаимодействие" }, assignee: { name: "Руководитель подразделения" },
  status: "NEW", createdAt: "2026-11-13T08:00:00Z",
}));
const analytics: AnalyticsDto = {
  total: 10, completed: 7, byCategory: [{ id: "c", name: "Категория", total: 10, completed: 7, rejected: 2, implemented: 5, overdue: 0 }],
  dailyTrend: [{ date: "2026-11-10", created: 3, responded: 1, completed: 1 }], scope: "OWN",
  asOf: "2026-11-13", new: 1, inProgress: 1, underReview: 1, needsClarification: 0, archived: 0, overdue: 0,
  reviewed: 7, reviewedShare: .7, averageFirstResponseHours: 1, firstResponseSampleSize: 7, implementedImprovements: 5,
  byType: [], byStatus: [], byDepartment: [], includesArchived: true, periodDays: "all", unassigned: 0,
  onTimeShare: 1, deadlineDistribution: { onTime: 3, approaching: 0, overdue: 0 },
};
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.mode = "ready"; mocks.push.mockClear(); mocks.refresh.mockClear();
  actor = { id: "employee", username: "employee", name: "Сотрудник", email: null, departmentId: "department", role: "EMPLOYEE", canViewCompanyAnalytics: false };
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => { root.unmount(); }); container.remove(); });
async function mountShell() {
  await act(async () => { root.render(<HomeShell actor={actor} unread={2} logout={vi.fn()} logoutError={null}><HomeDashboard /></HomeShell>); });
}

describe("Homepage permissions and actions", () => {
  it("reuses the shell for the registry with a single active link", async () => {
    await act(async () => { root.render(<HomeShell pathname="/tickets" actor={actor} unread={0} logout={vi.fn()} logoutError={null}><div>Реестр</div></HomeShell>); });
    expect(container.querySelectorAll(".home-sidebar")).toHaveLength(1);
    expect(container.querySelectorAll(".home-topbar")).toHaveLength(1);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("/tickets");
    expect(container.querySelector(".workspace-registry")).not.toBeNull();
  });
  it.each(["EMPLOYEE", "MANAGER", "ADMIN"] satisfies Role[])("keeps role-specific navigation for %s", async (role) => {
    actor = { ...actor, role }; await mountShell();
    const menu = container.querySelector("nav")!;
    expect(!!menu.querySelector('[href="/team"]')).toBe(role !== "EMPLOYEE");
    expect(!!menu.querySelector('[href="/settings"]')).toBe(role === "ADMIN");
    expect(!!menu.querySelector('[href="/settings/categories"]')).toBe(role === "ADMIN");
    expect(menu.querySelector('[href="/analytics"]')).not.toBeNull();
    expect([...container.querySelectorAll(".home-stat-value")].map(node => node.textContent)).toEqual(["10", "3", "5"]);
    expect(container.querySelector(".home-status-legend")?.textContent).toContain("20%");
    expect(container.textContent).not.toContain("к прошлой неделе");
  });
  it("focuses search with Ctrl+K and opens the existing filtered registry", async () => {
    await mountShell();
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true })); });
    const input = container.querySelector<HTMLInputElement>('.home-search input')!;
    expect(document.activeElement).toBe(input);
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(mocks.push).toHaveBeenCalledWith("/tickets");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "камера");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(mocks.push).toHaveBeenLastCalledWith(`/tickets?q=${encodeURIComponent("камера")}`);
  });
  it("provides real destinations, a language indicator and a closable profile menu", async () => {
    await mountShell();
    expect(container.querySelector('.home-notifications')?.getAttribute("href")).toBe("/notifications");
    expect(container.querySelector('.home-language')?.tagName).toBe("SPAN");
    const trigger = container.querySelector<HTMLButtonElement>('[aria-controls="home-profile-menu"]')!;
    await act(async () => { trigger.click(); });
    expect(container.querySelector('#home-profile-menu [href="/profile"]')).not.toBeNull();
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(container.querySelector('#home-profile-menu')).toBeNull();
    expect(container.querySelector('.home-support[href="/help"]')).not.toBeNull();
    expect(container.querySelector('.home-actions')).toBeNull();
    expect(container.querySelector('.home-create[href="/tickets/new"]')).not.toBeNull();
  });
  it("keeps company analytics separate from available ticket details", async () => {
    actor = { ...actor, role: "MANAGER", canViewCompanyAnalytics: true };
    await mountShell();
    expect(container.textContent).toContain("Общая аналитика не предоставляет доступ к чужим карточкам");
    expect(container.querySelectorAll(".home-table tbody tr")).toHaveLength(0);
  });
  it("keeps three recent records and their full destinations available", async () => {
    await mountShell();
    expect(container.querySelectorAll(".home-table tbody tr")).toHaveLength(3);
    expect(container.querySelector('.home-view-all')?.getAttribute("href")).toBe("/tickets");
    for (const ticket of recentTickets) {
      expect(container.textContent).toContain(ticket.title);
      expect(container.querySelector(`[href="/tickets/${ticket.id}"]`)).not.toBeNull();
    }
    expect(container.querySelector(".home-status-legend")?.textContent).toContain("Активные");
    expect([...container.querySelectorAll(".home-stat h2")].map(node => node.textContent)).toContain("Активные");
  });
  it("opens and closes the mobile sidebar without changing its links", async () => {
    await mountShell();
    const toggle = container.querySelector<HTMLButtonElement>('[aria-controls="home-sidebar"]')!;
    await act(async () => { toggle.click(); });
    expect(container.querySelector(".home-sidebar.is-open")).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(container.querySelector(".home-sidebar.is-open")).toBeNull();
  });
  it.each(["loading", "error", "empty"])("handles %s without fabricated data", async mode => {
    mocks.mode = mode; await mountShell();
    const values = [...container.querySelectorAll(".home-stat-value")].map(node => node.textContent);
    expect(values).toEqual(mode === "empty" ? ["0", "0", "0"] : ["—", "—", "—"]);
    if (mode === "loading") expect(container.querySelector('[role="status"]')).not.toBeNull();
    if (mode === "error") {
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      const retry = [...container.querySelectorAll("button")].find(button => button.textContent === "Повторить")!;
      await act(async () => { retry.click(); }); expect(mocks.refresh).toHaveBeenCalled();
    }
    if (mode === "empty") expect(container.textContent).toContain("Обращений пока нет");
  });
});
