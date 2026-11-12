// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTheme, setTheme, themeInitScript, themeStorageKey } from "@/lib/theme";

let root: Root | undefined;
let container: HTMLDivElement;
function boot() { new Function(themeInitScript)(); }
async function mount() {
  root = createRoot(container);
  await act(async () => { root!.render(createElement(ThemeToggle)); });
}
async function toggle() {
  await act(async () => { container.querySelector("button")!.click(); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = undefined;
  container.remove();
  vi.restoreAllMocks();
});

describe("Theme initialization, persistence and hydration", () => {
  it("uses light on the first visit and ignores invalid saved values", () => {
    for (const saved of [null, "system", "<script>dark</script>"]) {
      if (saved) localStorage.setItem(themeStorageKey, saved);
      else localStorage.removeItem(themeStorageKey);
      document.documentElement.dataset.theme = "dark";
      boot();
      expect(getTheme()).toBe("light");
    }
  });

  it("applies saved dark before mounting React and restores it on a new page", async () => {
    localStorage.setItem(themeStorageKey, "dark");
    boot();
    expect(getTheme()).toBe("dark");
    await mount();
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Включить светлую тему");
    await toggle();
    expect(localStorage.getItem(themeStorageKey)).toBe("light");
    expect(getTheme()).toBe("light");
    await toggle();
    document.documentElement.dataset.theme = "light";
    boot();
    expect(getTheme()).toBe("dark");
  });

  it("hydrates server markup under saved dark without recoverable errors", async () => {
    container.innerHTML = renderToString(createElement(ThemeToggle));
    localStorage.setItem(themeStorageKey, "dark");
    boot();
    const onRecoverableError = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, createElement(ThemeToggle), { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(getTheme()).toBe("dark");
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("still initializes and switches when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    boot();
    expect(getTheme()).toBe("light");
    await mount();
    await toggle();
    expect(getTheme()).toBe("dark");
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("synchronizes both controls and accepts changes from another tab", async () => {
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement("div", null, createElement(ThemeToggle), createElement(ThemeToggle, { login: true })));
    });
    await toggle();
    expect([...container.querySelectorAll("button")].every(button => button.getAttribute("aria-pressed") === "true")).toBe(true);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey, newValue: "light" }));
    });
    expect(getTheme()).toBe("light");
    await act(async () => { setTheme("dark"); });
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: null })); });
    expect(getTheme()).toBe("light");
  });
});
