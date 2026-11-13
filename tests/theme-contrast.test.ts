import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/app/theme.css", import.meta.url), "utf8");
const declarations = (block: string) => Object.fromEntries(
  [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]),
);
const light = declarations(css.match(/:root\s*\{([^}]+)\}/)![1]);
const dark = { ...light, ...declarations(css.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)![1]) };
function resolve(tokens: Record<string, string>, name: string): string {
  return tokens[name].replace(/var\((--[\w-]+)\)/g, (_, key: string) => resolve(tokens, key));
}
function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const textPairs = [
  ["--ink", "--page"], ["--ink", "--surface"], ["--ink", "--surface-raised"],
  ["--muted", "--surface"], ["--muted", "--surface-raised"],
  ["--muted-on-tint", "--accent-soft"],
  ["--accent", "--surface"], ["--accent", "--page"], ["--accent", "--accent-soft"],
  ["--accent-dark", "--surface"],
  ["--accent", "--success-bg"], ["--accent", "--warning-bg"],
  ["--accent", "--error-bg"], ["--accent", "--info-bg"],
  ["--success", "--success-bg"], ["--warning", "--warning-bg"],
  ["--error", "--error-bg"], ["--info", "--info-bg"],
  ["--badge-text", "--badge-bg"], ["--sidebar-text", "--sidebar"], ["--sidebar-muted", "--sidebar"],
];
for (const [name, tokens] of Object.entries({ light, dark })) {
  describe(`${name} theme contrast`, () => {
    it.each(textPairs)("%s on %s is at least 4.5:1", (foreground, background) => {
      expect(contrast(resolve(tokens, foreground), resolve(tokens, background))).toBeGreaterThanOrEqual(4.5);
    });
    it.each(["--primary-fill", "--primary-hover"])("text on %s is at least 4.5:1", (background) => {
      const foreground = resolve(tokens, "--on-primary");
      for (const stop of resolve(tokens, background).match(/#[\da-f]{6}/gi)!)
        expect(contrast(foreground, stop)).toBeGreaterThanOrEqual(4.5);
    });
    it.each(["--panel-fill", "--login-fill", "--login-choice-fill"])("secondary text on %s is at least 4.5:1", (background) => {
      const foreground = resolve(tokens, "--muted-on-tint");
      for (const stop of resolve(tokens, background).match(/#[\da-f]{6}\b/gi)!)
        expect(contrast(foreground, stop)).toBeGreaterThanOrEqual(4.5);
    });
    it("avatar initials remain readable", () => {
      for (const stop of resolve(tokens, "--profile-avatar-fill").match(/#[\da-f]{6}/gi)!)
        expect(contrast(resolve(tokens, "--ink"), stop)).toBeGreaterThanOrEqual(4.5);
    });
    it.each(["--control-border", "--focus", "--chart-primary", "--chart-orange", "--chart-green", "--chart-blue", "--chart-secondary", "--chart-error"])("%s against surface is at least 3:1", (foreground) => {
      expect(contrast(resolve(tokens, foreground), resolve(tokens, "--surface"))).toBeGreaterThanOrEqual(3);
    });
  });
}

it("keeps component colors centralized and all referenced color tokens defined", () => {
  const homeCss = readFileSync(new URL("../src/app/home.css", import.meta.url), "utf8");
  const homeTokens = declarations(homeCss.match(/\.workspace-home\s*\{([^}]+)\}/)![1]);
  const sources = ["app/globals.css", "components/charts.tsx", "components/dashboard.tsx", "components/ui/icon.tsx"];
  for (const file of sources) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    expect(source).not.toMatch(/#[\da-f]{3,8}\b/i);
    for (const match of source.matchAll(/var\((--[\w-]+)/g)) {
      if (!["--sidebar-width", "--header-height"].includes(match[1])) expect(file === "components/charts.tsx" ? { ...light, ...homeTokens } : light).toHaveProperty(match[1]);
    }
  }
});
