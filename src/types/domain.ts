export const roles = ["EMPLOYEE", "MANAGER", "ADMIN"] as const;
export const ticketTypes = [
  "PROBLEM",
  "SUGGESTION",
  "POSITIVE_FEEDBACK",
] as const;
export const statuses = [
  "NEW",
  "UNDER_REVIEW",
  "NEEDS_CLARIFICATION",
  "IN_PROGRESS",
  "IMPLEMENTED",
  "REJECTED",
  "CLOSED",
] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
export type Role = (typeof roles)[number];
export type TicketStatus = (typeof statuses)[number];
export type TicketType = (typeof ticketTypes)[number];
export type Priority = (typeof priorities)[number];
export interface Actor {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  departmentId: string;
  canViewCompanyAnalytics: boolean;
}
export const terminalStatuses: TicketStatus[] = [
  "IMPLEMENTED",
  "REJECTED",
  "CLOSED",
];
