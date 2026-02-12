import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}

main();
