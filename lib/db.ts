import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const globalDb = globalThis as unknown as { pool?: Pool };
const connectionString = process.env.DATABASE_URL;
const isLocalDb =
  connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

export const db =
  globalDb.pool ??
  new Pool({
    connectionString,
    max: 10,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
  });

if (!globalDb.pool) {
  globalDb.pool = db;
}
