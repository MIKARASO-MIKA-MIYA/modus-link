// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AdminDirectory } from "@/components/admin-directory";
const mocks = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => createElement("a", props) }));
vi.mock("@/components/app-frame", () => ({ useAuth: () => ({ actor: { id: "admin", role: "ADMIN" } }) }));
vi.mock("@/lib/client-api", async original => ({ ...await original<typeof import("@/lib/client-api")>(), writeApi: mocks.write }));
vi.mock("@/components/use-resource", () => ({ useResource: (url: string | null) => ({
  data: !url ? null : { items: url.startsWith("routing") ? [{ id: "rule", category: { name: "Категория" }, department: { name: "Отдел" }, assignee: { name: "Руководитель" }, isActive: true }] : url.startsWith("users") ? [{ id: "manager", name: "Руководитель", role: "MANAGER", isActive: true, departmentId: "option" }] : [{ id: "option", name: "Название", isActive: true }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }, error: null, loading: false, refresh: vi.fn(),
}) }));
it.each(["departments", "routing"] as const)("preserves the %s structure and existing create action", async kind => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); mocks.write.mockReset().mockResolvedValue({});
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } }, close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } } });
  const container = document.createElement("div"), root = createRoot(container); document.body.append(container);
  try {
    await act(async () => root.render(<AdminDirectory kind={kind} />));
    expect(container.querySelector(".categories-page")).toBeNull(); expect(container.querySelector(".team-page")).toBeNull(); expect(container.querySelector(".directory-panel")).not.toBeNull(); expect(container.querySelector(".sla-panel")).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>(".page-heading button")!.click());
    if (kind === "departments") container.querySelector<HTMLInputElement>('dialog [name="name"]')!.value = "Новый отдел";
    else {
      for (const [name, value] of [["categoryId", "option"], ["departmentId", "option"], ["assigneeId", "manager"]]) await act(async () => { const input = container.querySelector<HTMLSelectElement>(`dialog [name="${name}"]`)!; input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); });
    }
    expect(container.querySelector("dialog form")?.hasAttribute("novalidate")).toBe(true);
    await act(async () => container.querySelector("dialog form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mocks.write).toHaveBeenCalledWith(kind, kind === "departments" ? { name: "Новый отдел", isActive: true } : { categoryId: "option", departmentId: "option", assigneeId: "manager", isActive: true }, "POST");
    expect(container.querySelector("dialog")).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); }
});
