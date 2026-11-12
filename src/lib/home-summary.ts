import type { AnalyticsDto } from "@/types/api";

// The API's terminal count includes rejected outcomes, including later CLOSED
// tickets. Use outcomes rather than only the current REJECTED status.
export function homeSummary(data: Pick<AnalyticsDto, "total" | "completed" | "byCategory">) {
  const rejected = data.byCategory.reduce((sum, category) => sum + category.rejected, 0);
  const completed = data.completed - rejected;
  const active = data.total - data.completed;
  return { total: data.total, active, completed, rejected };
}

export function share(value: number, total: number) {
  return total > 0 ? `${Math.round(value / total * 100)}%` : "0%";
}
