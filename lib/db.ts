import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const globalDb = globalThis as unknown as { pool?: Pool };

export const db =
  globalDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (!globalDb.pool) {
  globalDb.pool = db;
}