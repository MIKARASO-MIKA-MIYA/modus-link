import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync(new URL("../src/app/home.css", import.meta.url), "utf8");
const parse = (text: string) => Object.fromEntries([...text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
const light = parse(css.match(/\.workspace-home\s*\{([^}]+)\}/)![1]);
const dark = { ...light, ...parse(css.match(/:root\[data-theme="dark"\] \.workspace-home\s*\{([^}]+)\}/)![1]) };
function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
for (const [name, tokens] of Object.entries({ light, dark })) describe(`${name} homepage palette`, () => {
  it.each([
    ["text", "surface"], ["muted", "surface"], ["link", "surface"],
    ["white", "navy"], ["on-navy", "navy"], ["white", "red"], ["white", "red-hover"],
    ["success", "success-bg"], ["error", "error-bg"],
  ])("%s on %s meets 4.5:1", (foreground, background) => {
    expect(contrast(tokens[`--home-${foreground}`], tokens[`--home-${background}`])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["plot", "active"])("%s chart marks meet 3:1", foreground => {
    expect(contrast(tokens[`--home-${foreground}`], tokens["--home-surface"])).toBeGreaterThanOrEqual(3);
  });
});
it("uses the exact approved navy and no decorative background gradients", () => {
  expect(light["--home-navy"]).toBe("#0A1427");
  expect(dark["--home-navy"]).toBe("#0A1427");
  expect(css).not.toMatch(/(?:linear|radial)-gradient/);
  expect(css).not.toMatch(/(?:^|\})\s*(?:body|:root\s*\{)/);
});
