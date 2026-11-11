import { mkdirSync, writeFileSync } from "node:fs";
const routes = {
  "auth/login": { POST: "loginPost" },
  "auth/logout": { POST: "logoutPost" },
  "auth/me": { GET: "meGet" },
  tickets: { GET: "ticketsGet", POST: "ticketsPost" },
  "tickets/[id]": { GET: "ticketGet", PATCH: "ticketPatch" },
  "tickets/[id]/status": { POST: "statusPost" },
  "tickets/[id]/assign": { POST: "assignPost" },
  "tickets/[id]/archive": { POST: "archivePost" },
  "tickets/[id]/comments": { GET: "commentsGet", POST: "commentsPost" },
  "tickets/[id]/history": { GET: "historyGet" },
  categories: { GET: "categoriesGet", POST: "categoriesPost" },
  "categories/[id]": { PATCH: "categoryPatch" },
  users: { GET: "usersGet", POST: "usersPost" },
  "users/me": { GET: "meGet" },
  "users/[id]": { PATCH: "userPatch" },
  routing: { GET: "routingGet", POST: "routingPost" },
  "routing/[id]": { PATCH: "routingPatch" },
  departments: { GET: "departmentsGet", POST: "departmentsPost" },
  "departments/[id]": { PATCH: "departmentPatch" },
  "analytics/overview": { GET: "overviewGet" },
  "analytics/categories": { GET: "analyticsCategoriesGet" },
  "analytics/departments": { GET: "analyticsDepartmentsGet" },
  health: { GET: "healthGet" },
};
for (const [path, handlers] of Object.entries(routes)) {
  const dir = `src/app/api/v1/${path}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/route.ts`,
    `export const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\nexport { ${[...Object.entries(handlers), ...["GET", "POST", "PATCH", "PUT", "DELETE"].filter((method) => !handlers[method]).map((method) => [method, "methodNotAllowed"])].map(([method, handler]) => `${handler} as ${method}`).join(", ")} } from "@/server/handlers";\n`,
  );
}
