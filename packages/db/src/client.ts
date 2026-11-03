import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let cached: { db: Db; pool: pg.Pool } | undefined;

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgres://vcp:vcp@localhost:5432/vcp";
}

/** Process-wide lazy client; safe to import from Next.js server code and the pipeline. */
export function getDb(): Db {
  if (!cached) {
    const pool = new pg.Pool({ connectionString: databaseUrl(), max: 10 });
    cached = { db: drizzle(pool, { schema }), pool };
  }
  return cached.db;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.pool.end();
    cached = undefined;
  }
}

export { schema };
