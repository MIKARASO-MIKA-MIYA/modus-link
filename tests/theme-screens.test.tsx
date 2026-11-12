// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, AnalyticsDto, PageDto, TicketDto } from "@/types/api";
import { LoginScreen } from "@/components/login-screen";
import { Dashboard } from "@/components/dashboard";
import { TicketsScreen } from "@/components/tickets-screen";
import { CreateTicket } from "@/components/create-ticket";
import { TicketDetail } from "@/components/ticket-detail";
import { TicketActionDialog, type TicketDialogKind } from "@/components/ticket-action-dialog";
import { AnalyticsScreen } from "@/components/analytics-screen";
import { AdminDirectory } from "@/components/admin-directory";
import { SettingsHome } from "@/components/settings-home";
import { HelpScreen, NotificationsScreen, ProfileScreen } from "@/components/info-screens";
import { ErrorNotice, Loading } from "@/components/ui/shared";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({
  useAuth: () => ({ actor, department: "Учебный отдел", logout: vi.fn() }),
}));
vi.mock("@/components/use-resource", () => ({
  useResource: (url: string | null) => ({ data: dataFor(url), loading: false, error: null, refresh: vi.fn() }),
}));

const employee: Actor = {
  id: "employee", username: "employee", name: "Условный сотрудник", email: null,
  departmentId: "department", role: "EMPLOYEE", canViewCompanyAnalytics: false,
};
let actor: Actor;
const category = { id: "category", name: "Рабочие процессы", description: "Учебная категория", isActive: true };
const department = { id: "department", name: "Учебный отдел", isActive: true };
const ticket: TicketDto = {
  id: "ticket", number: "MP-00000001", sequence: 1, title: "Проверка оформления", description: "Синтетический текст для проверки интерфейса",
  type: "PROBLEM", categoryId: category.id, authorId: employee.id, departmentId: department.id,
  assigneeId: "manager", priority: "HIGH", status: "NEEDS_CLARIFICATION", resolution: null, outcome: null,
  dueAt: "2026-12-01T12:00:00Z", firstRespondedAt: "2026-11-12T10:00:00Z", createdAt: "2026-11-12T08:00:00Z",
  updatedAt: "2026-11-12T10:00:00Z", closedAt: null, archivedAt: null, version: 1, isSynthetic: true,
  sourceAuthorRole: null, sourceAssigneeRole: null, author: employee,
  assignee: { ...employee, id: "manager", role: "MANAGER" }, category, department,
};
const page = <T,>(items: T[]): PageDto<T> => ({ items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } });
const group = { id: "group", name: "Учебная группа", total: 3, completed: 1, overdue: 1, implemented: 1, rejected: 0 };
const analytics: AnalyticsDto = {
  asOf: "2026-11-12T12:00:00Z", total: 3, new: 1, inProgress: 1, underReview: 0, needsClarification: 1,
  completed: 1, archived: 0, overdue: 1, reviewed: 2, reviewedShare: 2 / 3, averageFirstResponseHours: 2,
  firstResponseSampleSize: 2, implementedImprovements: 1, byType: [{ type: "PROBLEM", total: 2 }, { type: "SUGGESTION", total: 1 }],
  byStatus: [{ status: "NEW", total: 1 }], byCategory: [group], byDepartment: [group], scope: "COMPANY",
  includesArchived: true, periodDays: "30", unassigned: 1, onTimeShare: 0.5,
  deadlineDistribution: { onTime: 1, approaching: 1, overdue: 1 },
  dailyTrend: [{ date: "2026-11-11", created: 2, responded: 1, completed: 0 }, { date: "2026-11-12", created: 1, responded: 1, completed: 1 }],
};
function dataFor(url: string | null): unknown {
  if (!url) return null;
  if (url.startsWith("analytics/")) return analytics;
  if (url === "tickets/ticket") return ticket;
  if (url.includes("/comments")) return page([{ id: "comment", content: "Уточнение сотрудника", author: employee, createdAt: ticket.createdAt, visibility: "PUBLIC" }]);
  if (url.includes("/history")) return page([{ id: "history", action: "CREATED", newValue: {}, actor: employee, createdAt: ticket.createdAt }]);
  if (url.includes("/attachments")) return { items: [{ id: "file", filename: "Пример.pdf", size: 1024, createdAt: ticket.createdAt }] };
  if (url.startsWith("tickets?")) return page([ticket]);
  if (url.startsWith("categories?")) return page([category]);
  if (url.startsWith("departments?")) return page([department]);
  if (url.startsWith("users?")) return page([{ ...employee, isActive: true }]);
  if (url.startsWith("routing?")) return page([{ id: "rule", category, department, assignee: ticket.assignee, isActive: true }]);
  if (url === "notifications") return { items: [{ id: "notice", action: "STATUS_CHANGED", actor: employee, ticket, createdAt: ticket.createdAt }] };
  throw new Error(`Uncovered resource ${url}`);
}
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  actor = { ...employee, id: "admin", role: "ADMIN" };
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  // jsdom has no native modal/top-layer implementation. Only content/open state
  // is tested here; focus, backdrop rendering and geometry require a browser.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } },
  });
});
afterEach(async () => {
  await act(async () => { root.unmount(); }); container.remove(); vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
async function render(element: ReactElement) {
  await act(async () => { root.render(element); });
}

const screens: [string, () => ReactElement, string][] = [
  ["вход", () => createElement(LoginScreen, { onLogin: vi.fn() }), ".login-card"],
  ["реестр", () => createElement(TicketsScreen), ".registry-table"],
  ["создание", () => createElement(CreateTicket), ".create-panel form"],
  ["карточка", () => createElement(TicketDetail, { id: ticket.id }), ".ticket-detail-grid"],
  ["аналитика", () => createElement(AnalyticsScreen), ".trend-chart svg"],
  ["настройки", () => createElement(SettingsHome), ".settings-cards"],
  ["пользователи", () => createElement(AdminDirectory, { kind: "users" }), ".data-table"],
  ["подразделения", () => createElement(AdminDirectory, { kind: "departments" }), ".data-table"],
  ["категории", () => createElement(AdminDirectory, { kind: "categories" }), ".data-table"],
  ["маршрутизация", () => createElement(AdminDirectory, { kind: "routing" }), ".data-table"],
  ["уведомления", () => createElement(NotificationsScreen), ".notification-row"],
  ["профиль", () => createElement(ProfileScreen), ".profile-fields"],
  ["справка", () => createElement(HelpScreen), ".faq-item"],
];
for (const theme of ["light", "dark"] as const) {
  describe(`${theme}: component coverage with synthetic fixtures (not visual QA)`, () => {
    beforeEach(() => { document.documentElement.dataset.theme = theme; });
    it.each(screens)("renders %s", async (_, screen, selector) => {
      await render(screen());
      expect(container.querySelector(selector)).not.toBeNull();
      expect(document.documentElement.dataset.theme).toBe(theme);
    });
    it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("renders %s dashboard", async (role) => {
      actor = { ...actor, role }; await render(createElement(Dashboard));
      expect(container.querySelector("h1")).not.toBeNull();
      if (role === "MANAGER") expect(container.querySelectorAll(".donut-wrap svg").length).toBeGreaterThan(0);
    });
    it.each(["status", "assign", "due", "edit", "archive", "upload"] satisfies TicketDialogKind[])("opens %s ticket dialog", async (kind) => {
      await render(createElement(TicketActionDialog, { kind, ticket, onClose: vi.fn(), onUpdated: vi.fn(), onConflict: vi.fn() }));
      expect(container.querySelector("dialog[open] form")).not.toBeNull();
    });
    it("opens the admin form and renders errors/loading", async () => {
      await render(createElement(AdminDirectory, { kind: "categories" }));
      await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Добавить категорию"))!.click(); });
      expect(container.querySelector("dialog[open] input")).not.toBeNull();
      await render(createElement("div", null, createElement(ErrorNotice, { message: "Синтетическая ошибка" }), createElement(Loading)));
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.querySelector('[role="status"]')).not.toBeNull();
    });
  });
}
