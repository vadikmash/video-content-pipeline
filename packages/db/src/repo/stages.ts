import { and, eq } from "drizzle-orm";
import { Stage, type StageStatus, newId } from "@vcp/core";
import { getDb } from "../client";
import { stages } from "../schema";

type Row = typeof stages.$inferSelect;

export function toStage(r: Row): Stage {
  return Stage.parse({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    status: r.status,
    inputHash: r.inputHash ?? undefined,
    providerId: r.providerId ?? undefined,
    startedAt: r.startedAt?.toISOString(),
    finishedAt: r.finishedAt?.toISOString(),
    attempt: r.attempt,
    error: r.error ?? undefined,
    artifactId: r.artifactId ?? undefined,
    runId: r.runId ?? undefined,
  });
}

export async function listStages(projectId: string): Promise<Stage[]> {
  const rows = await getDb().select().from(stages).where(eq(stages.projectId, projectId));
  return rows.map(toStage);
}

export async function getStage(projectId: string, name: string): Promise<Stage | undefined> {
  const [row] = await getDb()
    .select()
    .from(stages)
    .where(and(eq(stages.projectId, projectId), eq(stages.name, name)))
    .limit(1);
  return row ? toStage(row) : undefined;
}

export interface StagePatch {
  status?: StageStatus;
  inputHash?: string;
  providerId?: string;
  startedAt?: Date;
  finishedAt?: Date | null;
  attempt?: number;
  error?: string | null;
  artifactId?: string;
  runId?: string;
}

/** Insert-or-update the single stage row for (projectId, name). */
export async function upsertStage(projectId: string, name: string, patch: StagePatch): Promise<Stage> {
  const db = getDb();
  const existing = await getStage(projectId, name);
  if (existing) {
    const [row] = await db
      .update(stages)
      .set(patch)
      .where(and(eq(stages.projectId, projectId), eq(stages.name, name)))
      .returning();
    return toStage(row!);
  }
  const [row] = await db
    .insert(stages)
    .values({ id: newId(), projectId, name, ...patch })
    .returning();
  return toStage(row!);
}

export async function incrementAttempt(projectId: string, name: string): Promise<number> {
  const existing = await getStage(projectId, name);
  const attempt = (existing?.attempt ?? 0) + 1;
  await upsertStage(projectId, name, { attempt });
  return attempt;
}
