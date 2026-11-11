import { getUsernameError, normalizeUsername } from "@/lib/usernames";
import { z } from "zod";
import { priorities, roles, statuses, ticketTypes } from "@/types/domain";
export const idSchema = z.uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const usernameSchema = z.string().trim().max(64, "Ник слишком длинный.")
 .transform(normalizeUsername).superRefine((username, context) => {
  const message = getUsernameError(username);
  if (message) context.addIssue({ code: "custom", message });
 });
const emailSchema = z.email().max(254).transform(v => v.toLowerCase());
export const loginSchema = z.object({ username: usernameSchema.optional(), email: emailSchema.optional(), password: z.string().min(1).max(256) }).strict().refine(v => Boolean(v.username) !== Boolean(v.email), "Укажите ник");
export const registerSchema = z.object({ username: usernameSchema, password: z.string().min(12, "Придумайте пароль не короче 12 символов").max(256) }).strict();
export const createTicketSchema = z
  .object({
    title: text(3, 200),
    description: text(10, 10000),
    type: z.enum(ticketTypes),
    categoryId: idSchema,
    priority: z.enum(priorities).default("MEDIUM"),
  })
  .strict();
const version = z.number().int().positive();
export const updateTicketSchema = z
  .object({
    version,
    title: text(3, 200).optional(),
    description: text(10, 10000).optional(),
    priority: z.enum(priorities).optional(),
    dueAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Нет изменений");
export const statusSchema = z
  .object({
    version,
    status: z.enum(statuses),
    resolution: text(5, 10000).optional(),
    message: text(5, 5000).optional(),
  })
  .strict();
export const assignSchema = z
  .object({ version, assigneeId: idSchema.nullable(), reason: text(5, 1000) })
  .strict();
export const archiveSchema = z
  .object({ version, archived: z.boolean(), reason: text(5, 1000) })
  .strict();
export const commentSchema = z
  .object({
    version,
    content: text(1, 5000),
    visibility: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
  })
  .strict();
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
export const pageSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const filterSchema = pageSchema
  .extend({
    authorId: idSchema.optional(),
    assigneeId: idSchema.optional(),
    sortBy: z.enum(["createdAt", "number", "dueAt"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
    categoryId: idSchema.optional(),
    status: z.enum(statuses).optional(),
    departmentId: idSchema.optional(),
    type: z.enum(ticketTypes).optional(),
    priority: z.enum(priorities).optional(),
    dueBefore: z.iso.datetime({ offset: true }).optional(),
    dueAfter: z.iso.datetime({ offset: true }).optional(),
    overdue: bool.optional(),
    unassigned: bool.optional(),
    archived: bool.default(false),
    includeArchived: bool.default(false),
    stateGroup: z.enum(["ACTIVE", "COMPLETED", "IMPLEMENTED"]).optional(),
    q: text(2, 100).optional(),
  })
  .refine(
    (v) =>
      !v.dueBefore ||
      !v.dueAfter ||
      new Date(v.dueBefore) >= new Date(v.dueAfter),
    "Неверный диапазон сроков",
  );
export const categorySchema = z
  .object({
    name: text(2, 120),
    description: text(1, 1000).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict();
export const categoryPatchSchema = categorySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Нет изменений");
export const routingSchema = z
  .object({
    categoryId: idSchema,
    departmentId: idSchema.nullable().default(null),
    assigneeId: idSchema,
    isActive: z.boolean().default(true),
  })
  .strict();
export const routingPatchSchema = routingSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Нет изменений");
export const departmentSchema = z
  .object({ name: text(2, 120), isActive: z.boolean().default(true) })
  .strict();
export const departmentPatchSchema = departmentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Нет изменений");
const userFieldsSchema = z.object({
 name: text(2, 120), username: usernameSchema.optional(), email: emailSchema.nullable().optional(),
 password: z.string().min(12).max(256), role: z.enum(roles).default("EMPLOYEE"), departmentId: idSchema,
 canViewCompanyAnalytics: z.boolean().default(false),
}).strict();
export const userSchema = userFieldsSchema.refine(v => Boolean(v.username || v.email), "Укажите ник пользователя");
export const userPatchSchema = userFieldsSchema.omit({ password: true }).partial().extend({ password: z.string().min(12).max(256).optional(), isActive: z.boolean().optional() }).refine(v => Object.keys(v).length > 0, "Нет изменений");
export type TicketFilter = z.infer<typeof filterSchema>;
export const analyticsQuerySchema = z
  .object({ days: z.enum(["7", "30", "90", "all"]).default("all") })
  .strict();
