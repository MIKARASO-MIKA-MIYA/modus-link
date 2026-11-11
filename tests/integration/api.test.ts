import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { seedDemo, seedId } from "../../prisma/seed-data";
import source from "../../prisma/data/tickets.json";
import type {
  Actor,
  CategoryDto,
  HistoryDto,
  CommentDto,
  OverviewDto,
  PageDto,
  TicketDto,
  AnalyticsDto,
  AttachmentDto,
} from "@/types/api";
const origin = process.env.TEST_API_ORIGIN!;
const password = process.env.DEMO_PASSWORD ?? "ModusDemo2026!";
const suffix = randomUUID().slice(0, 8);
let employee = "",
  manager = "",
  admin = "",
  owner = "",
  other = "";
let routed: TicketDto, orphan: TicketDto, category: CategoryDto;
async function req<T = unknown>(
  path: string,
  cookie = "",
  method = "GET",
  body?: unknown,
  requestOrigin = origin,
) {
  const response = await fetch(`${origin}/api/v1/${path}`, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await response.json()) as {
    data: T;
    error?: { code: string; message: string };
  };
  return { status: response.status, ...json, headers: response.headers };
}
async function signin(username: string, accountPassword = password) {
  const res = await req<Actor>("auth/login", "", "POST", { username, password: accountPassword });
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=lax");
  return cookie.split(";")[0];
}
const ticketInput = (categoryId: string) => ({
  title: `Интеграционный сценарий ${suffix}`,
  description:
    "Проверка сохранения и сквозного рассмотрения обращения в реальной БД",
  type: "PROBLEM",
  categoryId,
  priority: "HIGH",
});
beforeAll(async () => {
  if (!origin || !new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error(
      "Run npm run test:integration with isolated _test database",
    );
  await seedDemo(prisma, password);
  await prisma.loginThrottle.deleteMany();
  [employee, manager, admin, owner] = await Promise.all([
    signin("employee"),
    signin("manager"),
    signin("admin"),
    signin("owner"),
  ]);
  const otherEmail = `other-${suffix}@example.test`;
  expect(
    (
      await req("users", admin, "POST", {
        name: "Другой сотрудник",
        username: `other-${suffix}`,
        email: otherEmail,
        password,
        departmentId: seedId("dept:Продажи"),
      })
    ).status,
  ).toBe(201);
  other = await signin(`other-${suffix}`);
});
afterAll(async () => {
  await prisma.$disconnect();
});
describe.sequential("Real HTTP API and PostgreSQL", () => {
  it("registers without email and restores the same account and tickets after logout", async () => {
    const username = `ю _otsaka${suffix}`;
    const accountPassword = `MyOwnPassword-${suffix}!`;
    const created = await req<Actor>("auth/register", "", "POST", {
      username: `  ${username.toUpperCase().replace(" ", "   ")}  `,
      password: accountPassword,
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ username, email: null, role: "EMPLOYEE", canViewCompanyAnalytics: false });
    expect(created.data).not.toHaveProperty("passwordHash");
    expect(created.data).not.toHaveProperty("password");
    expect(created.headers.get("set-cookie")).toContain("HttpOnly");
    const cookie = created.headers.get("set-cookie")!.split(";")[0];
    expect((await req<Actor>("auth/me", cookie)).data.id).toBe(created.data.id);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain(accountPassword);
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const ticket = await req<TicketDto>("tickets", cookie, "POST", ticketInput(category.id));
    expect(ticket.status).toBe(201);
    expect((await req("auth/logout", cookie, "POST")).status).toBe(200);
    expect((await req("auth/me", cookie)).status).toBe(401);
    expect((await req("auth/login", "", "POST", { username, password: "wrong" })).status).toBe(401);
    const returnedCookie = await signin(username.toUpperCase().replace(" ", "   "), accountPassword);
    expect(returnedCookie).not.toBe(cookie);
    expect((await req<Actor>("auth/me", returnedCookie)).data.id).toBe(created.data.id);
    expect((await req<TicketDto>(`tickets/${ticket.data.id}`, returnedCookie)).data.authorId).toBe(created.data.id);
    await req("auth/logout", returnedCookie, "POST");
  });
  it("rejects duplicate normalized nicknames, including simultaneous registration", async () => {
    const username = `_unique ${suffix}`;
    const attempts = await Promise.all([
      req<Actor>("auth/register", "", "POST", { username, password }),
      req<Actor>("auth/register", "", "POST", { username: username.toUpperCase().replace(" ", "   "), password }),
    ]);
    expect(attempts.map(result => result.status).sort()).toEqual([201, 409]);
    expect(attempts.find(result => result.status === 409)?.error?.code).toBe("USERNAME_TAKEN");
    expect(await prisma.user.count({ where: { username } })).toBe(1);
    const duplicate = await req("auth/register", "", "POST", { username: ` ${username} `, password });
    expect(duplicate.status).toBe(409);
    expect(duplicate.error?.code).toBe("USERNAME_TAKEN");
  });
  it("validates registration and rejects requested privileges and cross-site creation", async () => {
    const username = `validation-${suffix}`;
    for (const input of [
      { username: "ab", password },
      { username: "name@example.test", password },
      { username: "with/slash", password },
      { username, password: "short" },
      { username, password, role: "ADMIN" },
      { username, password, canViewCompanyAnalytics: true },
      { username, password, departmentId: seedId("dept:Закупки") },
    ]) {
      expect((await req("auth/register", "", "POST", input)).status).toBe(422);
    }
    expect((await req("auth/register", "", "POST", { username, password }, "https://evil.example")).status).toBe(403);
    expect(await prisma.user.count({ where: { username } })).toBe(0);
  });
  it("rotates the previous session when registering another account", async () => {
    const oldCookie = await signin("employee");
    const created = await req<Actor>("auth/register", oldCookie, "POST", { username: `rotate-${suffix}`, password });
    expect(created.status).toBe(201);
    expect((await req("auth/me", oldCookie)).status).toBe(401);
    const newCookie = created.headers.get("set-cookie")!.split(";")[0];
    expect((await req<Actor>("auth/me", newCookie)).data.id).toBe(created.data.id);
    await req("auth/logout", newCookie, "POST");
  });
  it("preserves access by email for previously created accounts", async () => {
    const result = await req<Actor>("auth/login", "", "POST", { email: "employee@modus.local", password });
    expect(result.status).toBe(200);
    expect(result.data.username).toBe("employee");
    await req("auth/logout", result.headers.get("set-cookie")!.split(";")[0], "POST");
  });
  it("imports all original source records and preserves data on repeated seed", async () => {
    for (const row of source) {
      const t = await prisma.ticket.findUniqueOrThrow({
        where: { number: row.number },
        include: { category: true },
      });
      expect(t.description).toBe(row.description);
      expect(t.category.name).toBe(row.category);
      expect(t.sourceAuthorRole).toBe(row.authorRole);
      expect(t.sourceAssigneeRole).toBe(row.assigneeRole);
      expect(t.isSynthetic).toBe(true);
    }
    const before = await Promise.all([
      prisma.ticket.count(),
      prisma.ticketHistory.count(),
      prisma.ticketComment.count(),
    ]);
    await seedDemo(prisma, password);
    expect(
      await Promise.all([
        prisma.ticket.count(),
        prisma.ticketHistory.count(),
        prisma.ticketComment.count(),
      ]),
    ).toEqual(before);
  });
  it("requires login, rejects wrong passwords and cross-site writes", async () => {
    expect((await req("tickets")).status).toBe(401);
    expect(
      (
        await req("auth/login", "", "POST", {
          username: "employee",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await req(
          "auth/login",
          "",
          "POST",
          { username: "employee", password },
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    expect((await req<Actor>("auth/me", employee)).data.role).toBe("EMPLOYEE");
  });
  it("rejects missing required fields, unknown role and unauthorized admin settings", async () => {
    expect((await req("tickets", employee, "POST", {})).status).toBe(422);
    expect(
      (await req("categories", employee, "POST", { name: "Запрещено" })).status,
    ).toBe(403);
    const existing = await prisma.category.findFirstOrThrow();
    expect(
      (
        await req("tickets", employee, "POST", {
          ...ticketInput(existing.id),
          role: "ADMIN",
        })
      ).status,
    ).toBe(422);
  });
  it("routes by department before global rule and persists ticket and creation history", async () => {
    const cat = await req<CategoryDto>("categories", admin, "POST", {
      name: `Маршрутизация ${suffix}`,
    });
    expect(cat.status).toBe(201);
    category = cat.data;
    const global = await req<{ id: string }>("routing", admin, "POST", {
      categoryId: category.id,
      assigneeId: seedId("user:IT-специалист"),
    });
    expect(global.status).toBe(201);
    expect(
      (
        await req("routing", admin, "POST", {
          categoryId: category.id,
          departmentId: seedId("dept:Закупки"),
          assigneeId: seedId("user:Руководитель закупок"),
        })
      ).status,
    ).toBe(201);
    expect((await req("routing", admin, "PATCH", {})).status).toBe(405);
    expect(
      (
        await req(`routing/${global.data.id}`, admin, "PATCH", {
          isActive: true,
        })
      ).status,
    ).toBe(200);
    const res = await req<TicketDto>(
      "tickets",
      employee,
      "POST",
      ticketInput(category.id),
    );
    expect(res.status).toBe(201);
    routed = res.data;
    expect(routed.assigneeId).toBe(seedId("user:Руководитель закупок"));
    expect(routed.number).toMatch(/^MP-\d{8,}$/);
    expect(
      await prisma.ticket.findUnique({ where: { id: routed.id } }),
    ).toMatchObject({ title: routed.title, authorId: routed.authorId });
    expect(
      (
        await req<PageDto<HistoryDto>>(`tickets/${routed.id}/history`, employee)
      ).data.items.map((h) => h.action),
    ).toEqual(["CREATED", "ASSIGNED"]);
  });
  it("saves an unmatched ticket in the unassigned queue and supports fallback global routing", async () => {
    const cat = await req<CategoryDto>("categories", admin, "POST", {
      name: `Без правила ${suffix}`,
    });
    const res = await req<TicketDto>(
      "tickets",
      employee,
      "POST",
      ticketInput(cat.data.id),
    );
    expect(res.status).toBe(201);
    orphan = res.data;
    expect(orphan.assigneeId).toBeNull();
    const queue = await req<PageDto<TicketDto>>(
      `tickets?unassigned=true&categoryId=${cat.data.id}`,
      manager,
    );
    expect(queue.data.items.some((t) => t.id === orphan.id)).toBe(true);
    const otherTicket = await req<TicketDto>(
      "tickets",
      other,
      "POST",
      ticketInput(category.id),
    );
    expect(otherTicket.data.assigneeId).toBe(seedId("user:IT-специалист"));
    expect((await req(`tickets/${otherTicket.data.id}`, manager)).status).toBe(
      404,
    );
  });
  it("blocks IDOR for details, comments, history and write operations", async () => {
    for (const path of [
      `tickets/${routed.id}`,
      `tickets/${routed.id}/history`,
      `tickets/${routed.id}/comments`,
    ])
      expect((await req(path, other)).status).toBe(404);
    expect(
      (
        await req(`tickets/${routed.id}/status`, other, "POST", {
          version: routed.version,
          status: "UNDER_REVIEW",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await req(`tickets/${routed.id}/assign`, employee, "POST", {
          version: routed.version,
          assigneeId: routed.assigneeId,
          reason: "Самоназначение",
        })
      ).status,
    ).toBe(403);
  });
  it("manually assigns unallocated tickets and prevents self approval", async () => {
    const result = await req<TicketDto>(
      `tickets/${orphan.id}/assign`,
      manager,
      "POST",
      {
        version: orphan.version,
        assigneeId: seedId("user:Руководитель закупок"),
        reason: "Распределение очереди",
      },
    );
    expect(result.status).toBe(200);
    orphan = result.data;
    const self = await req<TicketDto>(
      "tickets",
      manager,
      "POST",
      ticketInput(category.id),
    );
    expect(self.data.assigneeId).not.toBe(self.data.authorId);
    expect(
      (
        await req(`tickets/${self.data.id}/status`, manager, "POST", {
          version: self.data.version,
          status: "UNDER_REVIEW",
        })
      ).status,
    ).toBe(403);
  });
  it("prevents premature archival and edits under optimistic locking", async () => {
    expect(
      (
        await req(`tickets/${routed.id}/archive`, manager, "POST", {
          version: routed.version,
          archived: true,
          reason: "Скрыть без результата",
        })
      ).status,
    ).toBe(409);
    const res = await req<TicketDto>(
      `tickets/${routed.id}`,
      employee,
      "PATCH",
      { version: routed.version, title: `Уточнённый заголовок ${suffix}` },
    );
    expect(res.status).toBe(200);
    routed = res.data;
    expect(
      (
        await req(`tickets/${routed.id}`, employee, "PATCH", {
          version: routed.version - 1,
          title: "Устаревшее изменение",
        })
      ).error?.code,
    ).toBe("VERSION_CONFLICT");
  });
  it("filters all required dimensions and applies pagination", async () => {
    const dueBefore = encodeURIComponent(
      new Date(Date.now() + 10 * 86400000).toISOString(),
    );
    const list = await req<PageDto<TicketDto>>(
      `tickets?categoryId=${category.id}&status=NEW&departmentId=${routed.departmentId}&type=PROBLEM&priority=HIGH&dueBefore=${dueBefore}&pageSize=1`,
      manager,
    );
    expect(list.status).toBe(200);
    expect(list.data.items).toHaveLength(1);
    expect(list.data.items[0]).toMatchObject({
      categoryId: category.id,
      departmentId: routed.departmentId,
      status: "NEW",
      type: "PROBLEM",
      priority: "HIGH",
    });
    expect(list.data.pagination.pageSize).toBe(1);
    expect((await req("tickets?pageSize=1000", employee)).status).toBe(422);
    const past = new Date(Date.now() - 86400000).toISOString();
    const updated = await req<TicketDto>(
      `tickets/${routed.id}`,
      manager,
      "PATCH",
      { version: routed.version, dueAt: past },
    );
    routed = updated.data;
    expect(
      (
        await req<PageDto<TicketDto>>(
          `tickets?overdue=true&categoryId=${category.id}`,
          employee,
        )
      ).data.items.some((t) => t.id === routed.id),
    ).toBe(true);
  });
  it("hides internal comments and their history from authors and excludes them from first response", async () => {
    const hidden = await req<{ ticket: TicketDto }>(
      `tickets/${routed.id}/comments`,
      manager,
      "POST",
      {
        version: routed.version,
        content: "Внутренняя служебная заметка",
        visibility: "INTERNAL",
      },
    );
    expect(hidden.status).toBe(201);
    routed = hidden.data.ticket;
    expect(routed.firstRespondedAt).toBeNull();
    expect(
      (
        await req<PageDto<CommentDto>>(
          `tickets/${routed.id}/comments`,
          employee,
        )
      ).data.items,
    ).toHaveLength(0);
    expect(
      (
        await req<PageDto<HistoryDto>>(`tickets/${routed.id}/history`, employee)
      ).data.items.some((h) => h.visibility === "INTERNAL"),
    ).toBe(false);
    expect(
      (
        await req(`tickets/${routed.id}/comments`, employee, "POST", {
          version: routed.version,
          content: "Нельзя скрывать от других",
          visibility: "INTERNAL",
        })
      ).status,
    ).toBe(403);
  });
  it("requests clarification and returns to review after author reply", async () => {
    const missing = await req(`tickets/${routed.id}/status`, manager, "POST", {
      version: routed.version,
      status: "NEEDS_CLARIFICATION",
    });
    expect(missing.status).toBe(422);
    const clarification = await req<TicketDto>(
      `tickets/${routed.id}/status`,
      manager,
      "POST",
      {
        version: routed.version,
        status: "NEEDS_CLARIFICATION",
        message: "Уточните пример и ожидаемый результат",
      },
    );
    expect(clarification.status).toBe(200);
    routed = clarification.data;
    expect(routed.firstRespondedAt).not.toBeNull();
    const reply = await req<{ ticket: TicketDto }>(
      `tickets/${routed.id}/comments`,
      employee,
      "POST",
      {
        version: routed.version,
        content: "Предоставляю требуемый пример и ожидаемый результат",
      },
    );
    expect(reply.status).toBe(201);
    routed = reply.data.ticket;
    expect(routed.status).toBe("UNDER_REVIEW");
    const events = (
      await req<PageDto<HistoryDto>>(`tickets/${routed.id}/history`, employee)
    ).data.items;
    expect(events.some((h) => h.action === "CLARIFICATION_REQUESTED")).toBe(
      true,
    );
    expect(events.some((h) => h.action === "CLARIFICATION_PROVIDED")).toBe(
      true,
    );
  });
  it("records decisions, requires rejection reason and archives without losing history", async () => {
    expect(
      (
        await req(`tickets/${routed.id}/status`, manager, "POST", {
          version: routed.version,
          status: "REJECTED",
        })
      ).status,
    ).toBe(422);
    const rejected = await req<TicketDto>(
      `tickets/${routed.id}/status`,
      manager,
      "POST",
      {
        version: routed.version,
        status: "REJECTED",
        resolution:
          "Не соответствует текущим требованиям; предложен альтернативный вариант",
      },
    );
    expect(rejected.status).toBe(200);
    routed = rejected.data;
    const closed = await req<TicketDto>(
      `tickets/${routed.id}/status`,
      manager,
      "POST",
      { version: routed.version, status: "CLOSED" },
    );
    expect(closed.status).toBe(200);
    routed = closed.data;
    expect(routed.outcome).toBe("REJECTED");
    const archived = await req<TicketDto>(
      `tickets/${routed.id}/archive`,
      manager,
      "POST",
      {
        version: routed.version,
        archived: true,
        reason: "Результат зафиксирован и доступен автору",
      },
    );
    expect(archived.status).toBe(200);
    routed = archived.data;
    expect(
      (
        await req<PageDto<TicketDto>>(
          `tickets?archived=true&categoryId=${category.id}`,
          employee,
        )
      ).data.items.some((t) => t.id === routed.id),
    ).toBe(true);
    expect(
      (await req<TicketDto>(`tickets/${routed.id}`, employee)).data.resolution,
    ).toContain("альтернативный");
    expect((await req(`tickets/${routed.id}`, admin, "DELETE")).status).toBe(
      405,
    );
    expect(
      (
        await req(`tickets/${routed.id}/comments`, manager, "POST", {
          version: routed.version,
          content: "Архив защищён",
        })
      ).status,
    ).toBe(409);
  });
  it("protects the ledger at database level", async () => {
    await expect(
      prisma.ticket.delete({ where: { id: routed.id } }),
    ).rejects.toThrow();
    const event = await prisma.ticketHistory.findFirstOrThrow({
      where: { ticketId: routed.id },
    });
    await expect(
      prisma.ticketHistory.update({
        where: { id: event.id },
        data: { newValue: {} },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.ticket.findUnique({ where: { id: routed.id } }),
    ).not.toBeNull();
  });
  it("detects simultaneous changes and rolls back the losing history event", async () => {
    const results = await Promise.all(
      ["Первое изменение срока", "Второе изменение срока"].map((title) =>
        req(`tickets/${orphan.id}`, manager, "PATCH", {
          version: orphan.version,
          title,
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: orphan.id, action: "UPDATED" },
      }),
    ).toBe(1);
  });
  it("completes the in-progress implementation flow with a recorded result", async () => {
    let current = (await req<TicketDto>(`tickets/${orphan.id}`, manager)).data;
    for (const status of ["UNDER_REVIEW", "IN_PROGRESS", "IMPLEMENTED"]) {
      const result = await req<TicketDto>(
        `tickets/${orphan.id}/status`,
        manager,
        "POST",
        {
          version: current.version,
          status,
          ...(status === "IMPLEMENTED"
            ? { resolution: "Изменение выполнено и результат проверен" }
            : {}),
        },
      );
      expect(result.status).toBe(200);
      current = result.data;
    }
    expect(current).toMatchObject({
      status: "IMPLEMENTED",
      outcome: "IMPLEMENTED",
      resolution: "Изменение выполнено и результат проверен",
    });
    expect(current.closedAt).not.toBeNull();
    expect(
      (await req<TicketDto>(`tickets/${orphan.id}`, employee)).data.status,
    ).toBe("IMPLEMENTED");
  });
  it("cannot complete without a result even through direct database access", async () => {
    const open = await prisma.ticket.findFirstOrThrow({
      where: { status: "NEW" },
    });
    await expect(
      prisma.ticket.update({
        where: { id: open.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          outcome: "CLOSED",
          resolution: null,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.ticket.update({
        where: { id: open.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          outcome: null,
          resolution: "Зафиксированный результат",
        },
      }),
    ).rejects.toThrow();
  });
  it("enforces a shared database login attempt limit", async () => {
    const username = `invalid-${suffix}`;
    for (let n = 0; n < 15; n++)
      expect(
        (await req("auth/login", "", "POST", { username, password: "wrong" }))
          .status,
      ).toBe(401);
    expect(
      (await req("auth/login", "", "POST", { username, password: "wrong" }))
        .status,
    ).toBe(429);
  });
  it("computes authorized analytics and separates owner analytics from ticket permissions", async () => {
    const own = await req<OverviewDto>("analytics/overview", employee);
    const company = await req<OverviewDto>("analytics/overview", owner);
    expect(own.data.scope).toBe("OWN");
    expect(own.data.total).toBe(
      await prisma.ticket.count({
        where: { authorId: seedId("user:Сотрудник закупок") },
      }),
    );
    expect(company.data.scope).toBe("COMPANY");
    expect(company.data.total).toBe(await prisma.ticket.count());
    expect(company.data.total).toBeGreaterThan(own.data.total);
    expect(company.data.averageFirstResponseHours).not.toBeNull();
    expect((await req(`tickets/${routed.id}`, owner)).status).toBe(404);
    expect((await req("routing", owner)).status).toBe(403);
    expect((await req("analytics/categories", manager)).status).toBe(200);
    expect((await req("analytics/departments", owner)).status).toBe(200);
  });
  it("can disable a rule after its category is deactivated", async () => {
    const cat = await req<CategoryDto>("categories", admin, "POST", {
      name: `Отключение правила ${suffix}`,
    });
    const rule = await req<{ id: string }>("routing", admin, "POST", {
      categoryId: cat.data.id,
      assigneeId: seedId("user:Руководитель закупок"),
    });
    expect(rule.status).toBe(201);
    expect(
      (
        await req(`categories/${cat.data.id}`, admin, "PATCH", {
          isActive: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await req(`routing/${rule.data.id}`, admin, "PATCH", {
          isActive: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (await req(`routing/${rule.data.id}`, admin, "PATCH", { isActive: true }))
        .status,
    ).toBe(422);
  });
  it("filters assignee and author without expanding scope and supports sorting", async () => {
    const list = await req<PageDto<TicketDto>>(
      `tickets?assigneeId=${seedId("user:Руководитель закупок")}&sortBy=dueAt&order=asc&pageSize=100`,
      manager,
    );
    expect(list.status).toBe(200);
    expect(
      list.data.items.every(
        (t) => t.assigneeId === seedId("user:Руководитель закупок"),
      ),
    ).toBe(true);
    const dates = list.data.items.map((t) => t.dueAt);
    expect(dates).toEqual([...dates].sort());
    expect(
      (
        await req<PageDto<TicketDto>>(
          `tickets?authorId=${seedId("user:Сотрудник бухгалтерии")}`,
          employee,
        )
      ).data.pagination.total,
    ).toBe(0);
    const search = await req<PageDto<TicketDto>>(
      "tickets?q=" + encodeURIComponent("Сотрудник закупок"),
      manager,
    );
    expect(search.data.items.length).toBeGreaterThan(0);
    expect(
      search.data.items.every((t) => t.author.name.includes("закупок")),
    ).toBe(true);
  });
  it("matches dashboard status groups and includes archived outcomes without expanding author access", async () => {
    for (const [stateGroup, filter] of [
      ["ACTIVE", { status: { in: ["UNDER_REVIEW", "IN_PROGRESS"] } }],
      ["COMPLETED", { status: { in: ["IMPLEMENTED", "REJECTED", "CLOSED"] } }],
      ["IMPLEMENTED", { outcome: "IMPLEMENTED" }],
    ] as const) {
      const result = await req<PageDto<TicketDto>>(
        `tickets?stateGroup=${stateGroup}&includeArchived=true`,
        employee,
      );
      expect(result.status).toBe(200);
      const rows = await prisma.ticket.findMany({
        where: { authorId: seedId("user:Сотрудник закупок") },
      });
      const expected = rows.filter((t) =>
        "outcome" in filter
          ? t.outcome === filter.outcome
          : (filter.status.in as readonly string[]).includes(t.status),
      );
      expect(result.data.pagination.total).toBe(expected.length);
    }
  });
  it("uses the selected analytics period and real event dates for chart series", async () => {
    const result = await req<AnalyticsDto>("analytics/overview?days=7", owner);
    expect(result.status).toBe(200);
    const count = await prisma.ticket.count({
      where: {
        createdAt: {
          gte: new Date(new Date(result.data.asOf).getTime() - 7 * 86400000),
        },
      },
    });
    expect(result.data.total).toBe(count);
    expect(
      result.data.dailyTrend.reduce((sum, point) => sum + point.created, 0),
    ).toBe(count);
    expect(result.data.byType.reduce((sum, row) => sum + row.total, 0)).toBe(
      count,
    );
    expect((await req("analytics/overview?days=999", employee)).status).toBe(
      422,
    );
  });
  it("returns only public notifications for accessible tickets", async () => {
    const result = await req<{
      items: { ticket: { id: string }; id: string }[];
    }>("notifications", employee);
    expect(result.status).toBe(200);
    for (const row of result.data.items) {
      const event = await prisma.ticketHistory.findUniqueOrThrow({
        where: { id: row.id },
        include: { ticket: true },
      });
      expect(event.visibility).toBe("PUBLIC");
      expect(event.ticket.authorId).toBe(seedId("user:Сотрудник закупок"));
    }
  });
  it("uploads and downloads private attachments with access checks and atomic history", async () => {
    const ticket = (
      await req<TicketDto>(
        "tickets",
        employee,
        "POST",
        ticketInput(category.id),
      )
    ).data;
    const content = "%PDF-1.7\nSynthetic integration attachment\n%%EOF";
    async function upload(
      version: number,
      filename = "example.pdf",
      type = "application/pdf",
      bytes = content,
    ) {
      const form = new FormData();
      form.set("version", String(version));
      form.set("file", new File([bytes], filename, { type }));
      const response = await fetch(
        `${origin}/api/v1/tickets/${ticket.id}/attachments`,
        {
          method: "POST",
          headers: { Origin: origin, Cookie: employee },
          body: form,
        },
      );
      return {
        status: response.status,
        body: (await response.json()) as {
          data: { ticket: TicketDto; attachment: AttachmentDto };
        },
      };
    }
    const uploaded = await upload(ticket.version);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data.ticket.version).toBe(ticket.version + 1);
    const attachment = uploaded.body.data.attachment;
    expect(attachment).not.toHaveProperty("storageKey");
    const download = await fetch(
      `${origin}/api/v1/tickets/${ticket.id}/attachments/${attachment.id}`,
      { headers: { Cookie: employee } },
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain("attachment");
    expect(await download.text()).toBe(content);
    expect(
      (await req(`tickets/${ticket.id}/attachments/${attachment.id}`, other))
        .status,
    ).toBe(404);
    expect(
      (
        await req<{ items: AttachmentDto[] }>(
          `tickets/${ticket.id}/attachments`,
          employee,
        )
      ).data.items,
    ).toHaveLength(1);
    expect((await upload(ticket.version)).status).toBe(409);
    expect(
      (
        await upload(
          uploaded.body.data.ticket.version,
          "danger.png",
          "image/png",
          "<svg onload='bad'/>",
        )
      ).status,
    ).toBe(422);
    expect(
      await prisma.attachment.count({ where: { ticketId: ticket.id } }),
    ).toBe(1);
    expect(
      await prisma.ticketHistory.count({
        where: { ticketId: ticket.id, action: "ATTACHMENT_ADDED" },
      }),
    ).toBe(1);
  });
  it("changes roles only through admin and revokes stale user sessions", async () => {
    const user = (await req<Actor>("auth/me", other)).data;
    expect(
      (await req(`users/${user.id}`, employee, "PATCH", { role: "ADMIN" }))
        .status,
    ).toBe(403);
    expect(
      (
        await req(`users/${user.id}`, admin, "PATCH", {
          role: "MANAGER",
          canViewCompanyAnalytics: true,
        })
      ).status,
    ).toBe(200);
    expect((await req("auth/me", other)).status).toBe(401);
    const cookie = await signin(user.username);
    expect((await req<Actor>("auth/me", cookie)).data).toMatchObject({
      role: "MANAGER",
      canViewCompanyAnalytics: true,
    });
    const adminUser = (await req<Actor>("auth/me", admin)).data;
    expect(
      (await req(`users/${adminUser.id}`, admin, "PATCH", { role: "EMPLOYEE" }))
        .status,
    ).toBe(403);
  });
  it("revokes server sessions on logout", async () => {
    const cookie = await signin("employee");
    expect((await req("auth/logout", cookie, "POST")).status).toBe(200);
    expect((await req("auth/me", cookie)).status).toBe(401);
  });
});
