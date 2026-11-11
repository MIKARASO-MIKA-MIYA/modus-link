import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
if (!process.env.TEST_DATABASE_URL) url.pathname += "_test";
const name = url.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*_test$/.test(name))
  throw new Error("Integration database name must end with _test");
const admin = new URL(url);
admin.pathname = "/postgres";
const client = new Client({
  connectionString: admin.toString(),
  connectionTimeoutMillis: 5000,
});
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
    .rowCount
)
  await client.query(`CREATE DATABASE "${name}"`);
await client.end();
const origin = "http://127.0.0.1:3100";
const originalTypes = readFileSync("next-env.d.ts");
const originalTsconfig = readFileSync("tsconfig.json");
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  APP_ORIGIN: origin,
  TEST_API_ORIGIN: origin,
  DEMO_SEED_ENABLED: "true",
  COOKIE_SECURE: "false",
  NODE_ENV: "test",
  NEXT_DIST_DIR: ".next-integration",
  ATTACHMENT_STORAGE_DIR: resolve(".storage/test-attachments"),
};
console.log(`Applying migrations to isolated database ${name}`);
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env, stdio: "inherit" },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
console.log(
  "Starting real Next.js HTTP server for integration tests on port 3100",
);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    env: { ...env, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
const capture = (chunk) => {
  logs = (logs + chunk.toString()).slice(-15000);
};
server.stdout.on("data", capture);
server.stderr.on("data", capture);
let code = 1;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Next.js exited during startup");
    try {
      if (
        logs.includes("Ready in") &&
        (
          await fetch(`${origin}/api/v1/health`, {
            signal: AbortSignal.timeout(1500),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await delay(1000);
  }
  if (!ready) throw new Error("Next.js startup timed out");
  console.log("HTTP server ready; running Vitest against PostgreSQL");
  code = await new Promise((resolve) => {
    const test = spawn(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", "tests/integration"],
      { env, stdio: "inherit" },
    );
    test.on("exit", (value) => resolve(value ?? 1));
  });
  if (code) console.error(logs);
} catch (error) {
  console.error(error, logs);
} finally {
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
      stdio: "ignore",
    });
  else server.kill("SIGTERM");
  writeFileSync("next-env.d.ts", originalTypes);
  writeFileSync("tsconfig.json", originalTsconfig);
}
process.exitCode = code;
