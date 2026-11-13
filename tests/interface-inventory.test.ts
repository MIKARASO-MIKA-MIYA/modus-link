import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import postcss from "postcss";
const root = new URL("../src/", import.meta.url);
it("audits every real page route without adding login or help aliases", () => {
  const routes = readdirSync(new URL("app/", root), { recursive: true }).map(String).map(path => path.replaceAll("\\", "/")).filter(path => path.endsWith("page.tsx")).map(path => `/${path.replace(/\/?page\.tsx$/, "")}`).sort();
  expect(routes).toEqual(["/", "/analytics", "/help", "/notifications", "/profile", "/settings", "/settings/categories", "/settings/departments", "/settings/routing", "/team", "/tickets", "/tickets/[id]", "/tickets/new"].sort());
});
it("has no legacy shell CSS, decorative gradients or purple component variants", () => {
  const cssFiles = readdirSync(new URL("app/", root)).map(String).filter(path => path.endsWith(".css"));
  for (const file of cssFiles) {
    const source = readFileSync(new URL(`app/${file}`, root), "utf8");
    expect(source).not.toMatch(/(?:linear|radial|conic)-gradient\(/i);
    postcss.parse(source).walkRules(rule => { expect(rule.selector).not.toMatch(/\.(?:workspace|sidebar|topbar|main-content|login-building|login-decoration)(?![\w-])/); });
  }
  const files = readdirSync(new URL("components/", root), { recursive: true }).map(String).filter(file => file.endsWith(".tsx"));
  for (const file of files) expect(readFileSync(new URL(`components/${file.replaceAll("\\", "/")}`, root), "utf8")).not.toMatch(/linearGradient|login-building|login-decoration|avatar-purple|tone-purple/);
});
