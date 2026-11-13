// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsScreen } from "@/components/analytics-screen";
import { Donut } from "@/components/charts";
import { analyticsScope, ticketScope } from "@/server/permissions";
import type { Actor, AnalyticsDto } from "@/types/api";
const mocks = vi.hoisted(() => ({ mode: "ready", scope: "OWN", urls: [] as string[], csv: vi.fn(), refresh: vi.fn(), loadedAt: 1794531600000 }));
vi.mock("@/components/ticket-table", () => ({ downloadCsv: mocks.csv }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string) => {
  mocks.urls.push(url);
  const empty = mocks.mode === "empty", period = new URLSearchParams(url.split("?")[1]).get("days")!;
  return { data: mocks.mode === "error" || mocks.mode === "loading" ? null : { ...data, periodDays: period, scope: mocks.scope, ...(empty ? { total: 0, new: 0, underReview: 0, inProgress: 0, needsClarification: 0, completed: 0, overdue: 0, onTimeShare: null, firstResponseSampleSize: 0, averageFirstResponseHours: null, implementedImprovements: 0, dailyTrend: [], byType: [], byCategory: [], byDepartment: [] } : {}) }, error: mocks.mode === "error" ? "Ошибка аналитики" : null, loading: mocks.mode === "loading", loadedAt: mocks.mode === "ready" || empty ? mocks.loadedAt : null, refresh: mocks.refresh };
} }));
const group = { id: "allowed", name: "Доступное подразделение", total: 10, completed: 4, overdue: 2, implemented: 2, rejected: 1 };
const data: AnalyticsDto = { total: 10, new: 1, underReview: 2, needsClarification: 1, inProgress: 2, completed: 4, overdue: 2, implementedImprovements: 2, averageFirstResponseHours: 3.5, firstResponseSampleSize: 7, reviewed: 7, reviewedShare: .7, asOf: "2026-11-12T00:00:00Z", archived: 1, byCategory: [group], byDepartment: [group], byStatus: [], byType: [{ type: "PROBLEM", total: 8 }, { type: "SUGGESTION", total: 2 }, { type: "POSITIVE_FEEDBACK", total: 0 }], dailyTrend: [{ date: "2026-11-10T05:00:00Z", created: 3, responded: 2, completed: 1 }, { date: "2026-11-12T05:00:00Z", created: 7, responded: 5, completed: 3 }], onTimeShare: .5, unassigned: 1, deadlineDistribution: { onTime: 3, approaching: 1, overdue: 2 }, scope: "OWN", includesArchived: true, periodDays: "30" };
let container: HTMLDivElement, root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.mode = "ready"; mocks.scope = "OWN"; mocks.urls = []; mocks.csv.mockReset(); mocks.refresh.mockReset(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount() { await act(async () => root.render(<AnalyticsScreen />)); }
for (const theme of ["light", "dark"]) describe(`${theme} analytics behavior (DOM fixtures, not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it("computes the four KPI and explains the actual metric definitions", async () => {
    await mount(); expect([...container.querySelectorAll(".metric-body strong")].map(n => n.textContent)).toEqual(["10", "6", "2", "4"]);
    const text = container.textContent!;
    for (const explanation of ["по дате создания", "не полная статистика событий", "интервалы могут объединять несколько суток", "Первая реакция", "Текстовый ответ не обязателен", "среди завершённых обращений выборки с датой закрытия", "размер этого знаменателя API отдельно не сообщает"]) expect(text).toContain(explanation);
    expect(text).not.toContain("рассмотрено"); expect(text).not.toContain("Первый ответ"); expect(text).not.toContain("к прошлой неделе");
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(new Date(mocks.loadedAt).toISOString());
    expect(text).toContain("не обновления записей в БД"); expect(container.querySelector("linearGradient")).toBeNull();
  });
  it.each(["7", "30", "90", "all"])("uses the existing API period %s and includes it in CSV", async days => {
    await mount(); const select = container.querySelector("select")!;
    await act(async () => { select.value = days; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(mocks.urls.at(-1)).toBe(`analytics/overview?days=${days}`);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Скачать отчёт CSV"]')!.click());
    const rows = mocks.csv.mock.calls[0][1] as (string | number)[][];
    expect(rows[1][1]).toBe(select.selectedOptions[0].textContent); expect(rows.at(-1)).toEqual([group.name, 10, 4, 2, 2, 1]);
  });
  it.each([["OWN", "Только ваши обращения"], ["DEPARTMENT_AND_ASSIGNED", "Ваши обращения, подразделение и назначенные вам"], ["COMPANY", "Вся компания"]])("exports only server-provided rows in %s scope", async (scope, label) => {
    mocks.scope = scope; await mount(); expect(container.querySelector(".analytics-context")?.textContent).toContain(label);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Скачать отчёт CSV"]')!.click());
    const rows = mocks.csv.mock.calls[0][1]; expect(rows[0]).toEqual(["Область", label]); expect(rows).toHaveLength(5); expect(container.querySelectorAll(".data-table tbody tr")).toHaveLength(1);
    expect(container.querySelectorAll('a[href^="/tickets/"]')).toHaveLength(0);
  });
  it.each(["loading", "error", "empty"])("renders %s without fabricated charts or export", async mode => {
    mocks.mode = mode; await mount(); expect(container.querySelector<HTMLButtonElement>('[aria-label="Скачать отчёт CSV"]')!.disabled).toBe(true); expect(container.querySelector(".trend-chart")).toBeNull();
    if (mode === "loading") expect(container.querySelector(".loading-state")).not.toBeNull();
    if (mode === "error") { expect(container.querySelector('[role="alert"]')).not.toBeNull(); expect(container.querySelector(".empty-state")).toBeNull(); await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()); expect(mocks.refresh).toHaveBeenCalledOnce(); mocks.mode = "ready"; await mount(); expect(container.querySelector(".trend-chart")).not.toBeNull(); }
    if (mode === "empty") { expect(container.querySelector(".empty-state")).not.toBeNull(); expect(container.querySelector(".analytics-additional")?.textContent).toContain("Нет данных"); expect(container.textContent).not.toContain("0%"); }
  });
  it("toggles chart series and preserves interval labels", async () => {
    await mount(); const button = [...container.querySelectorAll<HTMLButtonElement>(".trend-legend button")].find(n => n.textContent === "Первая реакция")!;
    expect(button.getAttribute("aria-pressed")).toBe("true"); expect(container.querySelectorAll(".trend-chart circle")).toHaveLength(6);
    await act(async () => button.click()); expect(button.getAttribute("aria-pressed")).toBe("false"); expect(container.querySelectorAll(".trend-chart circle")).toHaveLength(4);
    await act(async () => button.click()); expect(container.querySelectorAll(".trend-chart circle")).toHaveLength(6); expect(container.querySelector(".trend-chart title")?.textContent).toContain("Интервал от");
  });
  it("shows unavailable distribution without false percentages", async () => {
    await act(async () => root.render(<Donut items={[{ label: "Проблемы", value: 0 }]} />)); expect(container.textContent).toContain("Нет данных"); expect(container.textContent).not.toContain("0%");
  });
});
describe("unchanged server analytics permissions", () => {
  it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("keeps %s scope and respects the explicit company-analytics privilege", role => {
    const actor: Actor = { id: "actor", username: "actor", name: "Actor", email: null, role, departmentId: "department", canViewCompanyAnalytics: false };
    expect(analyticsScope(actor)).toEqual(role === "ADMIN" ? {} : ticketScope(actor));
    expect(analyticsScope({ ...actor, canViewCompanyAnalytics: true })).toEqual({});
    expect(ticketScope({ ...actor, canViewCompanyAnalytics: true })).toEqual(ticketScope(actor));
  });
});
