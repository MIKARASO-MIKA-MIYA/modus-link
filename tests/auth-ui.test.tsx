// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "@/components/app-frame";
import { ApiRequestError } from "@/lib/client-api";
import type { Actor } from "@/types/api";

const mocks = vi.hoisted(() => ({ api: vi.fn(), writeApi: vi.fn(), replace: vi.fn(), pathname: "/" }));
vi.mock("@/lib/client-api", async (original) => ({
  ...await original<typeof import("@/lib/client-api")>(),
  api: mocks.api,
  writeApi: mocks.writeApi,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => createElement("a", props),
}));
vi.mock("@/components/use-resource", () => ({
  useResource: () => ({ data: null, loading: false, error: null, refresh: vi.fn() }),
}));

const actor: Actor = {
  id: "employee-id", name: "Сотрудник", username: "employee", email: null,
  role: "EMPLOYEE", departmentId: "department-id", canViewCompanyAnalytics: false,
};
let container: HTMLDivElement;
let root: Root;
async function mount() {
  await act(async () => { root.render(createElement(AppFrame, null, "Содержимое кабинета")); });
}
async function click(text: string) {
  if (text === "Выход" && !container.querySelector("#home-profile-menu")) {
    const profile = container.querySelector<HTMLButtonElement>('[aria-controls="home-profile-menu"]');
    if (profile) await act(async () => { profile.click(); });
  }
  const button = [...container.querySelectorAll("button")].find(item => item.textContent?.trim() === text);
  expect(button, `Button ${text}`).toBeTruthy();
  await act(async () => { button!.click(); });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockReset();
  mocks.writeApi.mockReset();
  mocks.pathname = "/";
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

describe("Session restoration and logout UI", () => {
  it("keeps the existing shell on routes other than the homepage", async () => {
    mocks.pathname = "/tickets";
    mocks.api.mockResolvedValue(actor);
    await mount();
    expect(container.querySelector(".workspace-home")).toBeNull();
    expect(container.querySelector(".workspace .sidebar")).not.toBeNull();
  });
  it("shows login for an unauthenticated session", async () => {
    mocks.api.mockRejectedValue(new ApiRequestError(401, "UNAUTHENTICATED", "Войдите"));
    await mount();
    expect(container.querySelector(".login-page")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    new ApiRequestError(403, "FORBIDDEN", "Запрещено"),
    new ApiRequestError(500, "INTERNAL_ERROR", "Ошибка сервера"),
    new ApiRequestError(503, "UNAVAILABLE", "Нет БД"),
    new TypeError("Failed to fetch"),
  ])("offers retry instead of login when session lookup fails: %s", async (error) => {
    mocks.api.mockRejectedValueOnce(error).mockResolvedValueOnce(actor);
    await mount();
    expect(container.querySelector(".login-page")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не удалось проверить сессию");
    await click("Повторить");
    expect(container.textContent).toContain("Содержимое кабинета");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.api).toHaveBeenCalledTimes(2);
  });

  it.each([
    new ApiRequestError(403, "INVALID_ORIGIN", "Origin"),
    new ApiRequestError(500, "INTERNAL_ERROR", "Нет БД"),
    new TypeError("Failed to fetch"),
  ])("keeps the workspace after failed logout and allows retry: %s", async (error) => {
    mocks.api.mockResolvedValue(actor);
    mocks.writeApi.mockRejectedValueOnce(error).mockResolvedValueOnce({ loggedOut: true });
    await mount();
    await click("Выход");
    expect(container.textContent).toContain("Содержимое кабинета");
    expect(container.querySelector(".login-page")).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Сессия может оставаться активной");
    expect(mocks.replace).not.toHaveBeenCalled();
    await click("Повторить");
    expect(container.querySelector(".login-page")).not.toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(mocks.writeApi).toHaveBeenNthCalledWith(2, "auth/logout", {});
  });

  it("waits for the logout response before hiding the workspace", async () => {
    let finish!: (value: unknown) => void;
    mocks.api.mockResolvedValue(actor);
    mocks.writeApi.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await mount();
    await click("Выход");
    expect(container.textContent).toContain("Содержимое кабинета");
    await act(async () => { finish({ loggedOut: true }); });
    expect(container.querySelector(".login-page")).not.toBeNull();
  });

  it("returns to login when logout confirms that the session already expired", async () => {
    mocks.api.mockResolvedValue(actor);
    mocks.writeApi.mockRejectedValue(new ApiRequestError(401, "UNAUTHENTICATED", "Истекла"));
    await mount();
    await click("Выход");
    expect(container.querySelector(".login-page")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("responds to server-confirmed expiry from another protected request", async () => {
    mocks.api.mockResolvedValue(actor);
    await mount();
    await act(async () => { window.dispatchEvent(new Event("modus:session-expired")); });
    expect(container.querySelector(".login-page")).not.toBeNull();
  });
});
