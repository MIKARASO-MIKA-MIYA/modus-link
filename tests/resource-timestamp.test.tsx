// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useResource } from "@/components/use-resource";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/client-api", () => ({ api: mocks.api }));

it("records response receipt time, retains it on failure and separates query periods", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  let resource!: ReturnType<typeof useResource<{ value: number }>>;
  function Probe({ url }: { url: string }) { resource = useResource<{ value: number }>(url); return null; }
  const container = document.createElement("div"), root = createRoot(container);
  try {
    mocks.api.mockResolvedValueOnce({ value: 1 });
    await act(async () => root.render(<Probe url="analytics/overview?days=30" />));
    expect(resource.loadedAt).toBe(1000);
    now.mockReturnValue(2000); mocks.api.mockRejectedValueOnce(new Error("Offline"));
    await act(async () => resource.refresh());
    expect(resource.loadedAt).toBe(1000); expect(resource.error).toBe("Offline");
    mocks.api.mockResolvedValueOnce({ value: 2 });
    await act(async () => resource.refresh());
    expect(resource.loadedAt).toBe(2000); expect(resource.error).toBeNull();
    let finish!: (value: { value: number }) => void;
    mocks.api.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => root.render(<Probe url="analytics/overview?days=7" />));
    expect(resource.loadedAt).toBeNull(); expect(resource.data).toBeNull(); expect(resource.loading).toBe(true);
    now.mockReturnValue(3000); await act(async () => finish({ value: 3 }));
    expect(resource.loadedAt).toBe(3000); expect(resource.data).toEqual({ value: 3 });
  } finally { await act(async () => root.unmount()); now.mockRestore(); }
});
