import { desc, eq } from "drizzle-orm";
import { Project, type ProjectStatus, newId } from "@vcp/core";
import { getDb } from "../client";
import { projects } from "../schema";

type Row = typeof projects.$inferSelect;

export function toProject(r: Row): Project {
  return Project.parse({
    id: r.id,
    ideaId: r.ideaId,
    status: r.status,
    currentStage: r.currentStage ?? undefined,
    rejectReason: r.rejectReason ?? undefined,
    dryRun: r.dryRun,
    runId: r.runId ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}

export async function listProjects(): Promise<Project[]> {
  const rows = await getDb().select().from(projects).orderBy(desc(projects.createdAt));
  return rows.map(toProject);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const [row] = await getDb().select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ? toProject(row) : undefined;
}

export async function getProjectByIdea(ideaId: string): Promise<Project | undefined> {
  const [row] = await getDb()
    .select()
    .from(projects)
    .where(eq(projects.ideaId, ideaId))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  return row ? toProject(row) : undefined;
}

export async function createProject(ideaId: string, opts: { dryRun?: boolean } = {}): Promise<Project> {
  const [row] = await getDb()
    .insert(projects)
    .values({ id: newId(), ideaId, status: "active", dryRun: opts.dryRun ?? false })
    .returning();
  return toProject(row!);
}

export async function updateProject(
  id: string,
  patch: Partial<{ status: ProjectStatus; currentStage: string; rejectReason: string; runId: string }>,
): Promise<void> {
  await getDb()
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, id));
}
