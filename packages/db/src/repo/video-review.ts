import { and, desc, eq, isNull } from "drizzle-orm";
import type { Render, Storyboard } from "@vcp/core";
import { getDb } from "../client";
import { projects, renders, stages, storyboards } from "../schema";

const gate = "approve-video";
const gateRow = (projectId: string) => and(eq(stages.projectId, projectId), eq(stages.name, gate));

function reviewTransaction<T>(
  projectId: string,
  action: (tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0]) => Promise<T>,
) {
  return getDb().transaction(async (tx) => {
    // Serialize changes to the reviewed render and the gate for this project.
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (project?.status !== "waiting" || project.currentStage !== gate) return;
    return action(tx);
  });
}

export async function reserveVideoReview(projectId: string, renderId: string, requestId: string): Promise<boolean> {
  const reserved = await reviewTransaction(projectId, async (tx) => {
    const [current] = await tx.select({ id: renders.id }).from(renders).where(eq(renders.projectId, projectId))
      .orderBy(desc(renders.createdAt)).limit(1);
    if (current?.id !== renderId) return false;
    const [row] = await tx.update(stages).set({ status: "running", artifactId: requestId, error: null })
      .where(and(gateRow(projectId), eq(stages.status, "waiting"))).returning({ id: stages.id });
    return !!row;
  });
  return reserved === true;
}

export async function releaseVideoReview(projectId: string, requestId: string, error?: string): Promise<void> {
  await getDb().update(stages).set({ status: "waiting", artifactId: null, error: error ?? null })
    .where(and(gateRow(projectId), eq(stages.status, "running"), eq(stages.artifactId, requestId)));
}

export async function acceptVideoApproval(projectId: string, renderId: string, requestId?: string): Promise<boolean> {
  const [recorded] = await getDb().select({ id: stages.id }).from(stages).where(and(
    gateRow(projectId), eq(stages.status, "done"), eq(stages.artifactId, renderId),
  ));
  if (recorded) return true;
  const approved = await reviewTransaction(projectId, async (tx) => {
    const [current] = await tx.select({ id: renders.id }).from(renders).where(eq(renders.projectId, projectId))
      .orderBy(desc(renders.createdAt)).limit(1);
    if (current?.id !== renderId) return false;
    const [row] = await tx.update(stages).set({
      status: "done", providerId: "user", artifactId: renderId, finishedAt: new Date(), error: null,
    }).where(and(
      gateRow(projectId),
      requestId ? eq(stages.status, "running") : eq(stages.status, "waiting"),
      requestId ? eq(stages.artifactId, requestId) : isNull(stages.artifactId),
    )).returning({ id: stages.id });
    if (!row) return false;
    await tx.update(projects).set({ status: "active", updatedAt: new Date() }).where(eq(projects.id, projectId));
    return true;
  });
  return approved === true;
}

export async function commitReplacement(projectId: string, requestId: string, board: Storyboard, render: Render) {
  return reviewTransaction(projectId, async (tx) => {
    const [row] = await tx.update(stages).set({ status: "waiting", artifactId: null, error: null })
      .where(and(gateRow(projectId), eq(stages.status, "running"), eq(stages.artifactId, requestId)))
      .returning({ id: stages.id });
    if (!row) return;
    await tx.insert(storyboards).values({ ...board, createdAt: new Date(board.createdAt) });
    await tx.insert(renders).values({ ...render, createdAt: new Date(render.createdAt) });
    await tx.update(stages).set({ artifactId: board.id })
      .where(and(eq(stages.projectId, projectId), eq(stages.name, "assets")));
    await tx.update(stages).set({ artifactId: render.id, finishedAt: new Date() })
      .where(and(eq(stages.projectId, projectId), eq(stages.name, "render")));
    return true;
  });
}
