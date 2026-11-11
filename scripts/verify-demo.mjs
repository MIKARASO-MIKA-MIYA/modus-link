import "dotenv/config";
import assert from "node:assert/strict";
import { Client } from "pg";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
await client.connect();
try {
  const { rows } = await client.query(
    'SELECT count(*)::int AS tickets, count(*) FILTER (WHERE "isSynthetic")::int AS synthetic FROM "Ticket"',
  );
  console.log("Database register:", rows[0]);
  assert.ok(rows[0].synthetic >= 20);
  for (const path of [
    "/",
    "/tickets",
    "/tickets/new",
    "/settings",
    "/settings/routing",
    "/settings/categories",
    "/settings/departments",
    "/team",
    "/analytics",
    "/profile",
    "/notifications",
    "/help",
  ])
    assert.equal((await fetch(origin + path)).status, 200);
  const health = await (await fetch(`${origin}/api/v1/health`)).json();
  assert.equal(health.data.database, "connected");
  for (const [username, role, scope] of [
    ["employee", "EMPLOYEE", "OWN"],
    ["manager", "MANAGER", "DEPARTMENT_AND_ASSIGNED"],
    ["admin", "ADMIN", "COMPANY"],
    ["owner", "MANAGER", "COMPANY"],
  ]) {
    const response = await fetch(`${origin}/api/v1/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: process.env.DEMO_PASSWORD }),
    });
    assert.equal(response.status, 200);
    const user = (await response.json()).data;
    assert.equal(user.role, role);
    assert.equal(user.username, username);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const headers = { Cookie: cookie, Origin: origin };
    const data = (
      await (
        await fetch(`${origin}/api/v1/analytics/overview`, { headers })
      ).json()
    ).data;
    assert.equal(data.scope, scope);
    const list = (
      await (await fetch(`${origin}/api/v1/tickets`, { headers })).json()
    ).data;
    assert.ok(Array.isArray(list.items));
    console.log(
      `${role} / ${scope}: visible tickets=${list.pagination.total}; analytics total=${data.total}`,
    );
    assert.equal(
      (await fetch(`${origin}/api/v1/auth/logout`, { method: "POST", headers }))
        .status,
      200,
    );
  }
  console.log(
    "Real demo HTTP and database smoke check passed. No tickets were modified.",
  );
} finally {
  await client.end();
}
