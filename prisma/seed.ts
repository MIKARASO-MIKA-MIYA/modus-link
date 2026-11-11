import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDemo } from "./seed-data";
if (process.env.DEMO_SEED_ENABLED !== "true")
  throw new Error(
    "Set DEMO_SEED_ENABLED=true for the local synthetic demo database",
  );
if (!process.env.DEMO_PASSWORD) throw new Error("DEMO_PASSWORD is required");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  console.log(await seedDemo(prisma, process.env.DEMO_PASSWORD));
} finally {
  await prisma.$disconnect();
}
