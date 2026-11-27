import type { Idea, IdeaSource, NewIdea } from "@vcp/core";
import * as fakeSource from "@vcp/provider-fake-source";
import * as sourceWikimedia from "@vcp/provider-source-wikimedia";

/**
 * The one idea importer. The dashboard "Source from web" button and the pipeline's
 * cron/on-demand event both call runDiscovery, so dedupe and status handling match.
 *
 * Important: this module must not import the full provider registry — that pulls Remotion
 * into the Next.js dashboard bundle. Only lightweight IdeaSource modules are listed here.
 */
const SOURCES = {
  [fakeSource.manifest.id]: fakeSource,
  [sourceWikimedia.manifest.id]: sourceWikimedia,
} as const;

export interface DiscoverDeps {
  listIdeas: () => Promise<Idea[]>;
  /**
   * Insert unless an idea with this key exists; undefined means it already did.
   * Backed by a unique index, so overlapping runs cannot both insert the same idea.
   */
  insertIdeaIfNew: (idea: NewIdea, dedupeKey: string) => Promise<Idea | undefined>;
  /** The bound IdeaSource. source-manual (and unset) fall back to fake-source. */
  providerId?: string;
  /** Options from the port binding. */
  options?: Record<string, unknown>;
  /** Pre-built source (the pipeline passes one from its registry, with its blob store). */
  source?: IdeaSource;
  limit?: number;
}

export interface DiscoverResult {
  added: number;
  skipped: number;
  providerId: string;
  titles: string[];
}

function normaliseUrl(value: string): string {
  if (!URL.canParse(value)) return value.trim().toLowerCase();
  const url = new URL(value);
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep the encoded path
  }
  return `${url.hostname.replace(/^www\./, "")}${path.replace(/\/+$/, "")}`.toLowerCase();
}

/**
 * Same article, same idea: the key is the source URL without scheme, query or fragment,
 * percent-decoded and lower-cased; ideas without a URL fall back to their title.
 */
export function dedupeKey(idea: Pick<NewIdea, "title" | "sourceUrl">): string {
  if (idea.sourceUrl) return `url:${normaliseUrl(idea.sourceUrl)}`;
  return `title:${idea.title.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/** Every key an idea answers to: its dedupe key and its title, so a hand-added idea with the same title also counts. */
function matchKeys(idea: Pick<NewIdea, "title" | "sourceUrl">): string[] {
  return [...new Set([dedupeKey(idea), dedupeKey({ title: idea.title })])];
}

export function resolveSource(deps: Pick<DiscoverDeps, "providerId" | "options" | "source">): {
  source: IdeaSource;
  providerId: string;
} {
  if (deps.source) return { source: deps.source, providerId: deps.source.id };
  const providerId =
    !deps.providerId || deps.providerId === "source-manual" ? fakeSource.manifest.id : deps.providerId;
  const mod = SOURCES[providerId];
  if (!mod) throw new Error(`Unknown IdeaSource "${providerId}". Known: ${Object.keys(SOURCES).join(", ")}.`);
  return {
    source: mod.create({ options: deps.options ?? {}, env: process.env, blob: undefined as never }),
    providerId,
  };
}

/**
 * Run IdeaSource.discover and insert only ideas that are not already in the inbox.
 * Existing ideas are matched by URL key or title (covers hand-added ideas and rows from before
 * the dedupe column); the insert itself is conflict-safe for runs that overlap.
 */
export async function runDiscovery(deps: DiscoverDeps): Promise<DiscoverResult> {
  const { source, providerId } = resolveSource(deps);
  const found = await source.discover({ limit: deps.limit ?? 20 });
  const existing = await deps.listIdeas();
  const seen = new Set(existing.flatMap(matchKeys));

  const titles: string[] = [];
  let skipped = 0;
  for (const draft of found) {
    const keys = matchKeys(draft);
    if (keys.some((k) => seen.has(k))) {
      skipped += 1;
      continue;
    }
    for (const k of keys) seen.add(k);
    const key = dedupeKey(draft);
    const idea = await deps.insertIdeaIfNew({ ...draft, status: "new", origin: "research" }, key);
    if (!idea) {
      skipped += 1;
      continue;
    }
    titles.push(idea.title);
  }
  return { added: titles.length, skipped, providerId, titles };
}
