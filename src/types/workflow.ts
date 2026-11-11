import type { TicketStatus } from "./domain";
export const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["UNDER_REVIEW", "NEEDS_CLARIFICATION"],
  UNDER_REVIEW: [
    "NEEDS_CLARIFICATION",
    "IN_PROGRESS",
    "IMPLEMENTED",
    "REJECTED",
    "CLOSED",
  ],
  NEEDS_CLARIFICATION: ["UNDER_REVIEW"],
  IN_PROGRESS: ["NEEDS_CLARIFICATION", "IMPLEMENTED", "REJECTED"],
  IMPLEMENTED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};
