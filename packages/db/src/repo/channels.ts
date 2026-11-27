import { asc, eq } from "drizzle-orm";
import { ChannelProfile, CredentialRef, Language } from "@vcp/core";
import { getDb } from "../client";
import { channelLanguageDefaults, channels, projects } from "../schema";

type Row = typeof channels.$inferSelect;

function toChannel(r: Row, defaultFor: Language[]): ChannelProfile {
  return ChannelProfile.parse({
    channelId: r.channelId,
    provider: r.provider,
    label: r.label,
    credentialRef: r.credentialRef,
    defaultFor,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}

async function defaultsByChannel(): Promise<Map<string, Language[]>> {
  const rows = await getDb().select().from(channelLanguageDefaults).orderBy(asc(channelLanguageDefaults.language));
  const out = new Map<string, Language[]>();
  for (const r of rows) {
    const lang = Language.safeParse(r.language);
    if (!lang.success) continue;
    out.set(r.channelId, [...(out.get(r.channelId) ?? []), lang.data]);
  }
  return out;
}

export async function listChannels(): Promise<ChannelProfile[]> {
  const [rows, defaults] = await Promise.all([getDb().select().from(channels).orderBy(asc(channels.label)), defaultsByChannel()]);
  return rows.map((r) => toChannel(r, defaults.get(r.channelId) ?? []));
}

export async function getChannel(channelId: string): Promise<ChannelProfile | undefined> {
  const [row] = await getDb().select().from(channels).where(eq(channels.channelId, channelId)).limit(1);
  if (!row) return undefined;
  return toChannel(row, (await defaultsByChannel()).get(channelId) ?? []);
}

/**
 * Add a channel or update its label / credential reference. The channel ID is the key and is
 * never rewritten; reconnecting a credential must authenticate as the same ID (callers verify).
 */
export async function upsertChannel(input: { channelId: string; provider: string; label: string; credentialRef: string }): Promise<ChannelProfile> {
  const credentialRef = CredentialRef.parse(input.credentialRef);
  await getDb()
    .insert(channels)
    .values({ ...input, credentialRef })
    .onConflictDoUpdate({
      target: channels.channelId,
      set: { label: input.label, credentialRef, provider: input.provider, updatedAt: new Date() },
    });
  return (await getChannel(input.channelId))!;
}

/** The channel suggested for new projects in `language`, if any. */
export async function defaultChannelFor(language: Language): Promise<string | undefined> {
  const [row] = await getDb().select().from(channelLanguageDefaults).where(eq(channelLanguageDefaults.language, language)).limit(1);
  return row?.channelId;
}

/**
 * Set or clear the suggested channel for a language. Saved project destinations are not
 * touched: a default only pre-fills the picker.
 */
export async function setLanguageDefault(language: Language, channelId: string | null): Promise<void> {
  const db = getDb();
  if (!channelId) {
    await db.delete(channelLanguageDefaults).where(eq(channelLanguageDefaults.language, language));
    return;
  }
  await db
    .insert(channelLanguageDefaults)
    .values({ language, channelId })
    .onConflictDoUpdate({ target: channelLanguageDefaults.language, set: { channelId, updatedAt: new Date() } });
}

/** Save a project's destination. `null` clears it. */
export async function setProjectChannel(projectId: string, channelId: string | null): Promise<void> {
  await getDb().update(projects).set({ channelId, updatedAt: new Date() }).where(eq(projects.id, projectId));
}
