import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("DATABASE_URL is not set; database operations will fail until it is configured.");
}

export const pool = new Pool({
  connectionString: connectionString ?? ""
});

export const db = drizzle(pool);
