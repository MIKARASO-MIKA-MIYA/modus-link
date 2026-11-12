export const themeStorageKey = "modus:theme";
export const themeChangeEvent = "modus:theme-change";
export type Theme = "light" | "dark";
export const normalizeTheme = (value: string | null): Theme =>
  value === "dark" ? "dark" : "light";

// Runs synchronously in <head>, before the body can paint. Never interpolate
// localStorage values into HTML: only the two known themes are accepted.
export const themeInitScript = `(()=>{let t="light";try{if(localStorage.getItem("${themeStorageKey}")==="dark")t="dark"}catch{}document.documentElement.dataset.theme=t})()`;

export function getTheme(): Theme {
  return normalizeTheme(document.documentElement.dataset.theme ?? null);
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Private/blocked storage still allows switching for the current page.
  }
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function subscribeTheme(onChange: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === themeStorageKey || event.key === null) {
      document.documentElement.dataset.theme = normalizeTheme(event.newValue);
      onChange();
    }
  };
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", storageChanged);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", storageChanged);
  };
}
