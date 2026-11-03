import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./client";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = getDb();
  // Postgres in Docker may still be starting; retry briefly instead of failing the first `pnpm db:migrate`.
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(db, { migrationsFolder: path.resolve(here, "../drizzle") });
      break;
    } catch (err) {
      if (attempt >= 10) throw err;
      console.log(`database not ready (${(err as Error).message}); retrying in 1s`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.log("migrations applied");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
