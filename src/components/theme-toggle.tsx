"use client";
import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme";

const serverTheme = () => "light" as const;

export function ThemeToggle({ login = false }: { login?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, serverTheme);
  const label = theme === "light" ? "Включить тёмную тему" : "Включить светлую тему";
  return (
    <button
      type="button"
      className={`icon-button theme-toggle${login ? " login-theme-toggle" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={theme === "dark"}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "light" ? (
          <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />
        ) : (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
        )}
      </svg>
    </button>
  );
}
