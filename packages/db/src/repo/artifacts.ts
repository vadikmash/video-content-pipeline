import { desc, eq, inArray } from "drizzle-orm";
import { Asset, Brief, Narration, Render, Script, Storyboard, Upload } from "@vcp/core";
import { getDb } from "../client";
import { assets, briefs, narrations, renders, scripts, storyboards, uploads } from "../schema";

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

function toBrief(r: typeof briefs.$inferSelect): Brief {
  return Brief.parse({ ...r, createdAt: r.createdAt.toISOString() });
}

export async function insertBrief(b: Brief): Promise<Brief> {
  const [row] = await getDb()
    .insert(briefs)
    .values({ ...b, createdAt: new Date(b.createdAt) })
    .returning();
  return toBrief(row!);
}

export async function getBrief(id: string): Promise<Brief | undefined> {
  const [row] = await getDb().select().from(briefs).where(eq(briefs.id, id)).limit(1);
  return row ? toBrief(row) : undefined;
}

export async function latestBrief(projectId: string): Promise<Brief | undefined> {
  const [row] = await getDb()
    .select()
    .from(briefs)
    .where(eq(briefs.projectId, projectId))
    .orderBy(desc(briefs.createdAt))
    .limit(1);
  return row ? toBrief(row) : undefined;
}

// ---------------------------------------------------------------------------
// Scripts (append-only, versioned)
// ---------------------------------------------------------------------------

function toScript(r: typeof scripts.$inferSelect): Script {
  return Script.parse({
    ...r,
    reviewedBy: r.reviewedBy ?? undefined,
    createdAt: r.createdAt.toISOString(),
  });
}

export async function insertScript(s: Script): Promise<Script> {
  const [row] = await getDb()
    .insert(scripts)
    .values({ ...s, createdAt: new Date(s.createdAt) })
    .returning();
  return toScript(row!);
}

export async function getScript(id: string): Promise<Script | undefined> {
  const [row] = await getDb().select().from(scripts).where(eq(scripts.id, id)).limit(1);
  return row ? toScript(row) : undefined;
}

export async function listScripts(projectId: string): Promise<Script[]> {
  const rows = await getDb()
    .select()
    .from(scripts)
    .where(eq(scripts.projectId, projectId))
    .orderBy(desc(scripts.version));
  return rows.map(toScript);
}

export async function latestScript(projectId: string): Promise<Script | undefined> {
  return (await listScripts(projectId))[0];
}

export async function nextScriptVersion(projectId: string): Promise<number> {
  const latest = await latestScript(projectId);
  return (latest?.version ?? 0) + 1;
}

export async function markScriptReviewed(id: string, by: "user" | "auto"): Promise<void> {
  await getDb().update(scripts).set({ reviewedBy: by }).where(eq(scripts.id, id));
}

// ---------------------------------------------------------------------------
// Narrations
// ---------------------------------------------------------------------------

function toNarration(r: typeof narrations.$inferSelect): Narration {
  return Narration.parse({
    ...r,
    alignerProvider: r.alignerProvider ?? undefined,
    createdAt: r.createdAt.toISOString(),
  });
}

export async function insertNarration(n: Narration): Promise<Narration> {
  const [row] = await getDb()
    .insert(narrations)
    .values({ ...n, createdAt: new Date(n.createdAt) })
    .returning();
  return toNarration(row!);
}

export async function getNarration(id: string): Promise<Narration | undefined> {
  const [row] = await getDb().select().from(narrations).where(eq(narrations.id, id)).limit(1);
  return row ? toNarration(row) : undefined;
}

export async function latestNarration(projectId: string): Promise<Narration | undefined> {
  const [row] = await getDb()
    .select()
    .from(narrations)
    .where(eq(narrations.projectId, projectId))
    .orderBy(desc(narrations.createdAt))
    .limit(1);
  return row ? toNarration(row) : undefined;
}

// ---------------------------------------------------------------------------
// Storyboards (append-only, versioned)
// ---------------------------------------------------------------------------

function toStoryboard(r: typeof storyboards.$inferSelect): Storyboard {
  return Storyboard.parse({ ...r, createdAt: r.createdAt.toISOString() });
}

export async function insertStoryboard(s: Storyboard): Promise<Storyboard> {
  const [row] = await getDb()
    .insert(storyboards)
    .values({ ...s, createdAt: new Date(s.createdAt) })
    .returning();
  return toStoryboard(row!);
}

export async function updateStoryboard(
  id: string,
  patch: Partial<Pick<Storyboard, "scenes" | "containsSyntheticMedia">>,
): Promise<Storyboard> {
  const [row] = await getDb().update(storyboards).set(patch).where(eq(storyboards.id, id)).returning();
  return toStoryboard(row!);
}

export async function getStoryboard(id: string): Promise<Storyboard | undefined> {
  const [row] = await getDb().select().from(storyboards).where(eq(storyboards.id, id)).limit(1);
  return row ? toStoryboard(row) : undefined;
}

export async function latestStoryboard(projectId: string): Promise<Storyboard | undefined> {
  const [row] = await getDb()
    .select()
    .from(storyboards)
    .where(eq(storyboards.projectId, projectId))
    .orderBy(desc(storyboards.version))
    .limit(1);
  return row ? toStoryboard(row) : undefined;
}

export async function nextStoryboardVersion(projectId: string): Promise<number> {
  const latest = await latestStoryboard(projectId);
  return (latest?.version ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

function toAsset(r: typeof assets.$inferSelect): Asset {
  return Asset.parse({
    ...r,
    durationSec: r.durationSec ?? undefined,
    createdAt: r.createdAt.toISOString(),
  });
}

export async function insertAsset(a: Asset, projectId?: string): Promise<Asset> {
  const [row] = await getDb()
    .insert(assets)
    .values({ ...a, projectId, createdAt: new Date(a.createdAt) })
    .onConflictDoNothing()
    .returning();
  return row ? toAsset(row) : a;
}

export async function getAssets(ids: string[]): Promise<Asset[]> {
  if (!ids.length) return [];
  const rows = await getDb().select().from(assets).where(inArray(assets.id, ids));
  return rows.map(toAsset);
}

// ---------------------------------------------------------------------------
// Renders
// ---------------------------------------------------------------------------

function toRender(r: typeof renders.$inferSelect): Render {
  return Render.parse({
    ...r,
    thumbnailBlob: r.thumbnailBlob ?? undefined,
    createdAt: r.createdAt.toISOString(),
  });
}

export async function insertRender(r: Render): Promise<Render> {
  const [row] = await getDb()
    .insert(renders)
    .values({ ...r, createdAt: new Date(r.createdAt) })
    .returning();
  return toRender(row!);
}

export async function getRender(id: string): Promise<Render | undefined> {
  const [row] = await getDb().select().from(renders).where(eq(renders.id, id)).limit(1);
  return row ? toRender(row) : undefined;
}

export async function latestRender(projectId: string): Promise<Render | undefined> {
  const [row] = await getDb()
    .select()
    .from(renders)
    .where(eq(renders.projectId, projectId))
    .orderBy(desc(renders.createdAt))
    .limit(1);
  return row ? toRender(row) : undefined;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

function toUpload(r: typeof uploads.$inferSelect): Upload {
  return Upload.parse({
    ...r,
    remoteUrl: r.remoteUrl ?? undefined,
    publishAt: r.publishAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}

export async function insertUpload(u: Upload): Promise<Upload> {
  const [row] = await getDb()
    .insert(uploads)
    .values({
      ...u,
      publishAt: u.publishAt ? new Date(u.publishAt) : null,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    })
    .returning();
  return toUpload(row!);
}

export async function updateUpload(u: Upload): Promise<Upload> {
  const [row] = await getDb()
    .update(uploads)
    .set({
      privacy: u.privacy,
      status: u.status,
      remoteUrl: u.remoteUrl,
      publishAt: u.publishAt ? new Date(u.publishAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(uploads.id, u.id))
    .returning();
  return toUpload(row!);
}

export async function getUpload(id: string): Promise<Upload | undefined> {
  const [row] = await getDb().select().from(uploads).where(eq(uploads.id, id)).limit(1);
  return row ? toUpload(row) : undefined;
}

export async function latestUpload(projectId: string): Promise<Upload | undefined> {
  const [row] = await getDb()
    .select()
    .from(uploads)
    .where(eq(uploads.projectId, projectId))
    .orderBy(desc(uploads.createdAt))
    .limit(1);
  return row ? toUpload(row) : undefined;
}
