import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
const url = new URL(
  process.env.DATABASE_URL ??
    "postgresql://modus:modus_local_only@127.0.0.1:5432/modus_pulse",
);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw new Error("Local PostgreSQL requires a localhost DATABASE_URL");
const databaseDir = resolve(".postgres/data");
const db = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  authMethod: "scram-sha-256",
  autoRehydrateSymlinks: true,
  postgresFlags: ["-h", "127.0.0.1"],
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await db.initialise();
await db.start();
const client = db.getPgClient();
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
  throw new Error("Invalid local database name");
const exists = await client.query(
  "SELECT 1 FROM pg_database WHERE datname=$1",
  [name],
);
if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}"`);
await client.end();
console.log(
  `Local PostgreSQL ready on 127.0.0.1:${url.port || 5432}/${name}. Ctrl+C stops it; data is retained.`,
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
setInterval(() => {}, 60000);
