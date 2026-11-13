// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "@/components/app-frame";
import { ProfileScreen, NotificationsScreen, HelpScreen } from "@/components/info-screens";
import { SettingsHome } from "@/components/settings-home";
import NotFound from "@/app/not-found";
import ErrorPage from "@/app/error";
import type { Actor } from "@/types/api";
const mocks = vi.hoisted(() => ({ pathname: "/profile", noticeMode: "ready", api: vi.fn(), write: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), api: mocks.api, writeApi: mocks.write }));
let actor: Actor, container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.pathname = "/profile"; mocks.noticeMode = "ready"; mocks.api.mockReset(); mocks.write.mockReset().mockResolvedValue({}); mocks.push.mockReset(); mocks.replace.mockReset(); localStorage.clear();
  actor = { id: "actor", username: "actor", name: "Пользователь", email: null, role: "EMPLOYEE", departmentId: "department", canViewCompanyAnalytics: false };
  mocks.api.mockImplementation(async (path: string) => {
    if (path === "auth/me") return actor;
    if (path.startsWith("departments")) return { items: [{ id: "department", name: "Подразделение" }], pagination: { total: 1 } };
    if (path === "notifications") { if (mocks.noticeMode === "error") throw new Error("Уведомления недоступны"); return { items: mocks.noticeMode === "empty" ? [] : [{ id: "notice", action: "STATUS_CHANGED", createdAt: "2026-11-13T00:00:00Z", actor: { name: "Ответственный" }, ticket: { id: "ticket", number: "MP-1", title: "Обращение" } }] }; }
    if (path.startsWith("tickets?")) return { items: [], pagination: { total: 0 } };
    throw Error(`Unexpected resource ${path}`);
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(child: ReactNode) { await act(async () => root.render(<AppFrame>{child}</AppFrame>)); }
for (const theme of ["light", "dark"]) describe(`${theme} unified navigation and remaining screens (not visual QA)`, () => {
  beforeEach(() => { document.documentElement.dataset.theme = theme; });
  it.each(["EMPLOYEE", "MANAGER", "ADMIN"] as const)("keeps a single HomeShell across remaining routes for %s", async role => {
    actor = { ...actor, role };
    for (const [path, child] of [["/profile", <ProfileScreen key="profile" />], ["/notifications", <NotificationsScreen key="notices" />], ["/help", <HelpScreen key="help" />], ["/settings", <SettingsHome key="settings" />], ["/unknown-page", <NotFound key="404" />]] as const) {
      mocks.pathname = path; await render(child);
      expect(container.querySelectorAll(".home-sidebar")).toHaveLength(1); expect(container.querySelectorAll(".home-topbar")).toHaveLength(1); expect(container.querySelector(".workspace, .sidebar, .topbar, .main-content")).toBeNull();
      expect(!!container.querySelector('nav [href="/settings"]')).toBe(role === "ADMIN"); expect(!!container.querySelector('nav [href="/team"]')).toBe(role !== "EMPLOYEE");
      if (path === "/profile") expect(container.querySelector('.home-profile-trigger[aria-current="page"]')).not.toBeNull();
      if (path === "/notifications") expect(container.querySelector('.home-notifications[aria-current="page"]')).not.toBeNull();
      if (path === "/help") expect(container.querySelector('.home-support[aria-current="page"]')).not.toBeNull();
      if (path === "/settings") expect(container.textContent).toContain(role === "ADMIN" ? "Управление пользователями" : "Нет доступа к настройкам");
    }
    expect(mocks.api.mock.calls.filter(call => call[0] === "auth/me")).toHaveLength(1);
  });
  it("retains notification transitions and marking viewed", async () => {
    mocks.pathname = "/notifications"; await render(<NotificationsScreen />);
    expect(container.querySelector(".notification-row")?.getAttribute("href")).toBe("/tickets/ticket");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent === "Отметить просмотренными")!.click());
    expect(localStorage.getItem("modus:seen:actor")).not.toBeNull(); expect(container.textContent).toContain("Всё просмотрено");
  });
  it("shows notification errors without a false empty state", async () => {
    mocks.noticeMode = "error"; await render(<NotificationsScreen />); expect(container.textContent).toContain("Уведомления недоступны"); expect(container.querySelector(".empty-state")).toBeNull();
    mocks.noticeMode = "empty"; await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()); expect(container.querySelector(".empty-state")).not.toBeNull();
  });
  it("retains profile logout and help/settings destinations", async () => {
    actor = { ...actor, role: "ADMIN" }; await render(<ProfileScreen />); expect(container.textContent).toContain("Подразделение");
    mocks.pathname = "/settings"; await render(<SettingsHome />); for (const href of ["/team", "/settings/categories", "/settings/departments", "/settings/routing"]) expect(container.querySelector(`.settings-card[href="${href}"]`)).not.toBeNull();
    mocks.pathname = "/help"; await render(<HelpScreen />); expect(container.querySelector('.help-intro [href="/tickets/new"]')).not.toBeNull(); expect(container.querySelectorAll("details summary")).toHaveLength(6);
    mocks.pathname = "/profile"; await render(<ProfileScreen />); await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find(n => n.textContent?.trim() === "Выйти из системы")!.click()); expect(mocks.write).toHaveBeenCalledWith("auth/logout", {}); expect(container.querySelector(".login-page")).not.toBeNull(); expect(container.querySelector(".login-building, .login-decoration, linearGradient")).toBeNull();
  });
  it("styles the existing error fallback without exposing error details", async () => {
    const retry = vi.fn(); await render(<ErrorPage error={new Error("private diagnostic details")} retry={retry} />); expect(container.textContent).not.toContain("private diagnostic details"); await act(async () => container.querySelector<HTMLButtonElement>('.error-card button')!.click()); expect(retry).toHaveBeenCalledOnce();
  });
});
