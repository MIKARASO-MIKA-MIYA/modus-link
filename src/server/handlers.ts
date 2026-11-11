import { registerAccount } from "@/server/auth/register";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { body, ok, publicRoute, query, route } from "@/server/http";
import * as v from "@/server/validators";
import {
  cookieName,
  cookieOptions,
  login,
  tokenHash,
} from "@/server/auth/session";
import {
  actorSelect,
  listTickets,
  userSelect,
} from "@/server/repositories/tickets";
import * as tickets from "@/server/services/tickets";
import { analytics } from "@/server/services/analytics";
import { createUser, saveRule, updateUser } from "@/server/services/admin";
import { requireAdmin, ticketScope } from "@/server/permissions";
import { ensure } from "@/server/errors";
type Context = { params: Promise<{ id: string }> };
const idOf = async (ctx: Context) => v.idSchema.parse((await ctx.params).id);
export const loginPost = (req: NextRequest) =>
  publicRoute(req, async () => {
    const input = v.loginSchema.parse(await body(req));
    const result = await login(
      input.username ?? input.email!,
      input.password,
      req.cookies.get(cookieName)?.value,
    );
    const res = ok(result.actor);
    res.cookies.set(cookieName, result.token, {
      ...cookieOptions(),
      expires: result.expiresAt,
    });
    return res;
  });
export const logoutPost = (req: NextRequest) =>
  route(req, async () => {
    await prisma.session.deleteMany({
      where: { tokenHash: tokenHash(req.cookies.get(cookieName)!.value) },
    });
    const res = ok({ loggedOut: true });
    res.cookies.set(cookieName, "", { ...cookieOptions(), maxAge: 0 });
    return res;
  });
export const meGet = (req: NextRequest) =>
  route(req, async (actor) => ok(actor));
export const ticketsGet = (req: NextRequest) =>
  route(req, async (actor) =>
    ok(await listTickets(actor, v.filterSchema.parse(query(req)))),
  );
export const ticketsPost = (req: NextRequest) =>
  route(req, async (actor) =>
    ok(
      await tickets.createTicket(
        actor,
        v.createTicketSchema.parse(await body(req)),
      ),
      201,
    ),
  );
export const ticketGet = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(await tickets.getTicket(actor, await idOf(ctx))),
  );
export const ticketPatch = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await tickets.updateTicket(
        actor,
        await idOf(ctx),
        v.updateTicketSchema.parse(await body(req)),
      ),
    ),
  );
export const statusPost = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await tickets.setStatus(
        actor,
        await idOf(ctx),
        v.statusSchema.parse(await body(req)),
      ),
    ),
  );
export const assignPost = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await tickets.assignTicket(
        actor,
        await idOf(ctx),
        v.assignSchema.parse(await body(req)),
      ),
    ),
  );
export const archivePost = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await tickets.archiveTicket(
        actor,
        await idOf(ctx),
        v.archiveSchema.parse(await body(req)),
      ),
    ),
  );
export const commentsPost = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await tickets.addComment(
        actor,
        await idOf(ctx),
        v.commentSchema.parse(await body(req)),
      ),
      201,
    ),
  );
export const commentsGet = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) => {
    const p = v.pageSchema.parse(query(req));
    return ok(
      await tickets.ticketEvents(
        actor,
        await idOf(ctx),
        "comments",
        p.page,
        p.pageSize,
      ),
    );
  });
export const historyGet = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) => {
    const p = v.pageSchema.parse(query(req));
    return ok(
      await tickets.ticketEvents(
        actor,
        await idOf(ctx),
        "history",
        p.page,
        p.pageSize,
      ),
    );
  });
export const categoriesGet = (req: NextRequest) =>
  route(req, async (actor) => {
    const p = v.pageSchema.parse(query(req));
    const where = actor.role === "ADMIN" ? {} : { isActive: true };
    const [items, total] = await prisma.$transaction([
      prisma.category.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
      }),
      prisma.category.count({ where }),
    ]);
    return ok({
      items,
      pagination: { ...p, total, totalPages: Math.ceil(total / p.pageSize) },
    });
  });
export const categoriesPost = (req: NextRequest) =>
  route(req, async (actor) => {
    requireAdmin(actor);
    return ok(
      await prisma.category.create({
        data: v.categorySchema.parse(await body(req)),
      }),
      201,
    );
  });
export const categoryPatch = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) => {
    requireAdmin(actor);
    const id = await idOf(ctx);
    ensure(
      await prisma.category.findUnique({ where: { id } }),
      404,
      "NOT_FOUND",
      "Категория не найдена",
    );
    return ok(
      await prisma.category.update({
        where: { id },
        data: v.categoryPatchSchema.parse(await body(req)),
      }),
    );
  });
export const usersGet = (req: NextRequest) =>
  route(req, async (actor) => {
    const p = v.pageSchema.parse(query(req));
    const where =
      actor.role === "ADMIN"
        ? {}
        : actor.role === "MANAGER"
          ? { departmentId: actor.departmentId, isActive: true }
          : { id: actor.id };
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select:
          actor.role === "ADMIN"
            ? { ...actorSelect, isActive: true }
            : userSelect,
        orderBy: { name: "asc" },
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return ok({
      items,
      pagination: { ...p, total, totalPages: Math.ceil(total / p.pageSize) },
    });
  });
export const usersPost = (req: NextRequest) =>
  route(req, async (actor) =>
    ok(await createUser(actor, v.userSchema.parse(await body(req))), 201),
  );
export const userPatch = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await updateUser(
        actor,
        await idOf(ctx),
        v.userPatchSchema.parse(await body(req)),
      ),
    ),
  );
export const routingGet = (req: NextRequest) =>
  route(req, async (actor) => {
    requireAdmin(actor);
    const p = v.pageSchema.parse(query(req));
    const [items, total] = await prisma.$transaction([
      prisma.routingRule.findMany({
        orderBy: { id: "asc" },
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
        include: {
          category: true,
          department: true,
          assignee: { select: userSelect },
        },
      }),
      prisma.routingRule.count(),
    ]);
    return ok({
      items,
      pagination: { ...p, total, totalPages: Math.ceil(total / p.pageSize) },
    });
  });
export const routingPost = (req: NextRequest) =>
  route(req, async (actor) =>
    ok(await saveRule(actor, v.routingSchema.parse(await body(req))), 201),
  );
export const routingPatch = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await saveRule(
        actor,
        v.routingPatchSchema.parse(await body(req)),
        await idOf(ctx),
      ),
    ),
  );
export const departmentsGet = (req: NextRequest) =>
  route(req, async (actor) => {
    const p = v.pageSchema.parse(query(req));
    const where =
      actor.role === "ADMIN" || actor.canViewCompanyAnalytics
        ? {}
        : { id: actor.departmentId };
    const [items, total] = await prisma.$transaction([
      prisma.department.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
      }),
      prisma.department.count({ where }),
    ]);
    return ok({
      items,
      pagination: { ...p, total, totalPages: Math.ceil(total / p.pageSize) },
    });
  });
export const departmentsPost = (req: NextRequest) =>
  route(req, async (actor) => {
    requireAdmin(actor);
    return ok(
      await prisma.department.create({
        data: v.departmentSchema.parse(await body(req)),
      }),
      201,
    );
  });
export const departmentPatch = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) => {
    requireAdmin(actor);
    const id = await idOf(ctx);
    const input = v.departmentPatchSchema.parse(await body(req));
    ensure(
      await prisma.department.findUnique({ where: { id } }),
      404,
      "NOT_FOUND",
      "Подразделение не найдено",
    );
    if (input.isActive === false)
      ensure(
        (await prisma.user.count({
          where: { departmentId: id, isActive: true },
        })) === 0,
        409,
        "HAS_ACTIVE_USERS",
        "Сначала переведите или отключите сотрудников подразделения",
      );
    return ok(await prisma.department.update({ where: { id }, data: input }));
  });
export const overviewGet = (req: NextRequest) =>
  route(req, async (actor) =>
    ok(await analytics(actor, v.analyticsQuerySchema.parse(query(req)).days)),
  );
export const analyticsCategoriesGet = (req: NextRequest) =>
  route(req, async (actor) => {
    const data = await analytics(
      actor,
      v.analyticsQuerySchema.parse(query(req)).days,
    );
    return ok({ items: data.byCategory, scope: data.scope, asOf: data.asOf });
  });
export const analyticsDepartmentsGet = (req: NextRequest) =>
  route(req, async (actor) => {
    const data = await analytics(
      actor,
      v.analyticsQuerySchema.parse(query(req)).days,
    );
    return ok({ items: data.byDepartment, scope: data.scope, asOf: data.asOf });
  });
export const healthGet = (req: NextRequest) =>
  publicRoute(req, async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return ok({ status: "ok", database: "connected" });
    } catch {
      return ok({ status: "unavailable", database: "disconnected" }, 503);
    }
  });
export const methodNotAllowed = (req: NextRequest) =>
  publicRoute(req, async () => {
    const { AppError } = await import("@/server/errors");
    throw new AppError(
      405,
      "METHOD_NOT_ALLOWED",
      "Метод не поддерживается этим маршрутом",
    );
  });

export const notificationsGet = (req: NextRequest) =>
  route(req, async (actor) => {
    const items = await prisma.ticketHistory.findMany({
      where: {
        ticket: ticketScope(actor),
        actorId: { not: actor.id },
        visibility: "PUBLIC",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: { select: { name: true } },
        ticket: { select: { id: true, number: true, title: true } },
      },
    });
    return ok({ items });
  });

export const registerPost = (req: NextRequest) => publicRoute(req, async () => {
 const result = await registerAccount(v.registerSchema.parse(await body(req)), req.cookies.get(cookieName)?.value);
 const response = ok(result.actor, 201);
 response.cookies.set(cookieName, result.token, { ...cookieOptions(), expires: result.expiresAt });
 return response;
});