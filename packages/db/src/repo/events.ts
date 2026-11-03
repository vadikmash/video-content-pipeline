import { desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { events } from "../schema";

export async function logEvent(projectId: string | null, type: string, payload: Record<string, unknown> = {}) {
  await getDb().insert(events).values({ projectId, type, payload });
}

export async function listEvents(projectId: string) {
  return getDb().select().from(events).where(eq(events.projectId, projectId)).orderBy(desc(events.createdAt));
}
