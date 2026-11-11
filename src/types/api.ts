import type { Actor, Priority, Role, TicketStatus, TicketType } from "./domain";
export type { Actor, Priority, Role, TicketStatus, TicketType } from "./domain";
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId: string;
  };
}
export interface ApiSuccess<T> {
  data: T;
}
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface PageDto<T> {
  items: T[];
  pagination: Pagination;
}
export interface UserSummary {
  username: string;
  id: string;
  name: string;
  role: Role;
  departmentId: string;
}
export interface TicketDto {
  id: string;
  number: string;
  sequence: number;
  title: string;
  description: string;
  type: TicketType;
  categoryId: string;
  authorId: string;
  departmentId: string;
  assigneeId: string | null;
  priority: Priority;
  status: TicketStatus;
  resolution: string | null;
  outcome: TicketStatus | null;
  dueAt: string;
  firstRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  archivedAt: string | null;
  version: number;
  isSynthetic: boolean;
  sourceAuthorRole: string | null;
  sourceAssigneeRole: string | null;
  author: UserSummary;
  assignee: UserSummary | null;
  category: CategoryDto;
  department: DepartmentDto;
}
export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}
export interface DepartmentDto {
  id: string;
  name: string;
  isActive: boolean;
}
export interface CreateTicketInput {
  title: string;
  description: string;
  type: TicketType;
  categoryId: string;
  priority?: Priority;
}
export interface UpdateTicketInput {
  version: number;
  title?: string;
  description?: string;
  priority?: Priority;
  dueAt?: string;
}
export interface ChangeStatusInput {
  version: number;
  status: TicketStatus;
  resolution?: string;
  message?: string;
}
export interface AssignTicketInput {
  version: number;
  assigneeId: string | null;
  reason: string;
}
export interface CommentInput {
  version: number;
  content: string;
  visibility?: "PUBLIC" | "INTERNAL";
}
export interface CommentDto {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  visibility: "PUBLIC" | "INTERNAL";
  createdAt: string;
  author: UserSummary;
}
export interface HistoryDto {
  id: string;
  ticketId: string;
  actorId: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  visibility: "PUBLIC" | "INTERNAL";
  isSynthetic: boolean;
  createdAt: string;
  actor: UserSummary;
}
export interface MetricGroup {
  id: string;
  name: string;
  total: number;
  completed: number;
  overdue: number;
  implemented: number;
  rejected: number;
}
export interface OverviewDto {
  asOf: string;
  total: number;
  new: number;
  inProgress: number;
  underReview: number;
  needsClarification: number;
  completed: number;
  archived: number;
  overdue: number;
  reviewed: number;
  reviewedShare: number;
  averageFirstResponseHours: number | null;
  firstResponseSampleSize: number;
  implementedImprovements: number;
  byType: { type: TicketType; total: number }[];
  byStatus: { status: TicketStatus; total: number }[];
  byCategory: MetricGroup[];
  byDepartment: MetricGroup[];
  scope: "COMPANY" | "DEPARTMENT_AND_ASSIGNED" | "OWN";
  includesArchived: boolean;
}
export interface AuthState {
  user: Actor | null;
  loading: boolean;
  error: string | null;
}
export interface AnalyticsDto extends OverviewDto {
  periodDays: string;
  unassigned: number;
  onTimeShare: number | null;
  deadlineDistribution: {
    onTime: number;
    approaching: number;
    overdue: number;
  };
  dailyTrend: {
    date: string;
    created: number;
    responded: number;
    completed: number;
  }[];
}
export interface RoutingDto {
  id: string;
  categoryId: string;
  departmentId: string | null;
  assigneeId: string;
  isActive: boolean;
  category: CategoryDto;
  department: DepartmentDto | null;
  assignee: UserSummary;
}
export interface AdminUserDto extends Actor {
  isActive: boolean;
}
export interface AttachmentDto {
  id: string;
  ticketId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface RegisterInput { username: string; password: string }
export interface LoginInput { username: string; password: string }
