import { and, desc, eq, type SQL } from "drizzle-orm";
import { Idea, IdeaStatus, newId, type NewIdea } from "@vcp/core";
import { getDb } from "../client";
import { ideas } from "../schema";

type Row = typeof ideas.$inferSelect;

export function toIdea(r: Row): Idea {
  return Idea.parse({
    id: r.id,
    origin: r.origin,
    sourceProvider: r.sourceProvider ?? undefined,
    sourceUrl: r.sourceUrl ?? undefined,
    title: r.title,
    oneLiner: r.oneLiner,
    whySurprising: r.whySurprising,
    domain: r.domain,
    evidence: r.evidence,
    opinion: r.opinion,
    score: r.score ?? undefined,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  });
}

export interface IdeaFilters {
  status?: string;
  domain?: string;
  origin?: string;
}

export async function listIdeas(filters: IdeaFilters = {}): Promise<Idea[]> {
  const where: SQL[] = [];
  if (filters.status) where.push(eq(ideas.status, filters.status));
  if (filters.domain) where.push(eq(ideas.domain, filters.domain));
  if (filters.origin) where.push(eq(ideas.origin, filters.origin));
  const rows = await getDb()
    .select()
    .from(ideas)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(ideas.createdAt));
  return rows.map(toIdea);
}

export async function getIdea(id: string): Promise<Idea | undefined> {
  const [row] = await getDb().select().from(ideas).where(eq(ideas.id, id)).limit(1);
  return row ? toIdea(row) : undefined;
}

export async function insertIdea(input: NewIdea, id = newId()): Promise<Idea> {
  const [row] = await getDb()
    .insert(ideas)
    .values({
      id,
      origin: input.origin,
      sourceProvider: input.sourceProvider,
      sourceUrl: input.sourceUrl,
      title: input.title,
      oneLiner: input.oneLiner,
      whySurprising: input.whySurprising,
      domain: input.domain,
      evidence: input.evidence,
      opinion: input.opinion,
      score: input.score,
      status: input.status,
    })
    .returning();
  return toIdea(row!);
}

export async function setIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
  await getDb().update(ideas).set({ status }).where(eq(ideas.id, id));
}
