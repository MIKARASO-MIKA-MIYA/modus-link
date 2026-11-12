import { describe, expect, it } from "vitest";
import { homeSummary, share } from "@/lib/home-summary";

describe("Homepage status groups", () => {
  it("separates rejected outcomes from completed, including closed rejections", () => {
    const data = { total: 124, completed: 96, byCategory: [
      { id: "one", name: "Категория", total: 124, completed: 96, overdue: 0, implemented: 92, rejected: 4 },
    ] };
    const summary = homeSummary(data);
    expect(summary).toEqual({ total: 124, active: 28, completed: 92, rejected: 4 });
    expect(summary.active + summary.completed + summary.rejected).toBe(summary.total);
    expect(share(summary.completed, summary.total)).toBe("74%");
  });
  it("handles a completely empty scope without invented percentages", () => {
    expect(homeSummary({ total: 0, completed: 0, byCategory: [] })).toEqual({ total: 0, active: 0, completed: 0, rejected: 0 });
    expect(share(0, 0)).toBe("0%");
  });
});
