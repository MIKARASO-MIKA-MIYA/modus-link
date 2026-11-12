import { readFileSync } from "node:fs";
import postcss, { type AnyNode } from "postcss";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const css = postcss.parse(readFileSync(new URL("../src/app/home.css", import.meta.url), "utf8"));
// Stylesheet contract tests, not a browser layout engine or screenshot test.
function styles(selector: string, width: number, height: number, theme: string) {
  const result: Record<string, string> = {};
  css.walkRules(rule => {
    const selectors = rule.selector.split(",").map(value => value.trim());
    if (!selectors.includes(selector) && !(theme === "dark" && selectors.includes(`:root[data-theme="dark"] ${selector}`))) return;
    for (let parent: AnyNode | undefined = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== "atrule" || parent.name !== "media") continue;
      for (const match of parent.params.matchAll(/(min|max)-(width|height):\s*(\d+)px/g)) {
        const actual = match[2] === "width" ? width : height;
        if (match[1] === "min" ? actual < Number(match[3]) : actual > Number(match[3])) return;
      }
    }
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

for (const theme of ["light", "dark"]) describe(`${theme} responsive layout contracts`, () => {
  it.each([[1600, 900], [1920, 1080]])("allocates viewport rows at %ix%i without clipping page or table", (width, height) => {
    const page = styles(".workspace-home", width, height, theme);
    expect(page.height).toBe("100dvh");
    expect(page["grid-template-rows"]).toBe("48px minmax(min-content, 1fr)");
    expect(page.overflow).not.toBe("hidden");
    expect(page["overflow-y"]).not.toBe("hidden");
    expect(styles(".home-dashboard", width, height, theme)["grid-template-rows"]).toBe("auto auto minmax(190px, 1fr) auto");
    expect(styles(".home-middle", width, height, theme)["grid-template-columns"]).toBe(styles(".home-metrics", width, height, theme)["grid-template-columns"]);
    expect(styles(".home-trend-card", width, height, theme)["grid-column"]).toBe("span 2");
    const table = styles(".home-table-scroll", width, height, theme);
    expect(table.height).toBeUndefined(); expect(table["max-height"]).toBeUndefined();
    expect(styles(".home-nav-link > span:first-of-type", width, height, theme)["white-space"]).toBe("nowrap");
  });
  it.each([[1280, 720], [390, 844]])("allows normal document scrolling at %ix%i", (width, height) => {
    const page = styles(".workspace-home", width, height, theme);
    expect(page.height).toBeUndefined();
    expect(page.overflow).not.toBe("hidden");
    if (width < 600) {
      expect(styles(".home-metrics", width, height, theme)["grid-template-columns"]).toBe("1fr");
      expect(styles(".home-middle", width, height, theme)["grid-template-columns"]).toBe("1fr");
      expect(styles(".home-trend-card", width, height, theme)["grid-column"]).toBe("auto");
    }
  });
});

it("uses the transparent original logo without stretching or an opaque backdrop", async () => {
  const mark = readFileSync(new URL("../public/modus-link-logo.png", import.meta.url));
  const { data, info } = await sharp(mark).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info.width / info.height).toBe(1.5);
  for (let x = 0; x < info.width; x++) {
    expect(data[x * 4 + 3]).toBe(0);
    expect(data[((info.height - 1) * info.width + x) * 4 + 3]).toBe(0);
  }
  expect(data[(Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4 + 3]).toBeGreaterThan(240);
  const image = styles(".home-brand img", 1600, 900, "light");
  expect(parseFloat(image.width) / parseFloat(image.height)).toBe(60 / 40);
  expect(image["object-fit"]).toBe("contain");
});

it("provides standard ICO sizes and a PNG tab icon", async () => {
  const ico = readFileSync(new URL("../public/favicon.ico", import.meta.url));
  expect(ico.readUInt16LE(0)).toBe(0);
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(3);
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    expect(ico[entry]).toBe(size);
    expect(ico[entry + 1]).toBe(size);
    const offset = ico.readUInt32LE(entry + 12);
    const image = await sharp(ico.subarray(offset, offset + ico.readUInt32LE(entry + 8))).metadata();
    expect([image.width, image.height]).toEqual([size, size]);
  }
  const png = await sharp(readFileSync(new URL("../public/favicon-32.png", import.meta.url))).metadata();
  expect([png.width, png.height]).toEqual([32, 32]);
});
