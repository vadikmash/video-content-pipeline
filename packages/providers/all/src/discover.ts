import type { Idea, IdeaSource, NewIdea } from "@vcp/core";
import * as fakeSource from "@vcp/provider-fake-source";

export interface DiscoverDeps {
  listIdeas: () => Promise<Idea[]>;
  insertIdea: (idea: NewIdea) => Promise<Idea>;
  /** Prefer this provider; falls back to fake-source when unset or source-manual. */
  providerId?: string;
  /** Optional pre-built source (pipeline can inject a resolved IdeaSource). */
  source?: IdeaSource;
  limit?: number;
}

export interface DiscoverResult {
  added: number;
  skipped: number;
  providerId: string;
  titles: string[];
}

function dedupeKey(idea: Pick<NewIdea, "title" | "sourceUrl">): string {
  return (idea.sourceUrl ?? idea.title).trim().toLowerCase();
}

function resolveSource(deps: DiscoverDeps): { source: IdeaSource; providerId: string } {
  if (deps.source) return { source: deps.source, providerId: deps.source.id };
  const providerId =
    !deps.providerId || deps.providerId === "source-manual" ? fakeSource.manifest.id : deps.providerId;
  if (providerId !== fakeSource.manifest.id) {
    throw new Error(
      `Dashboard discovery only knows "${fakeSource.manifest.id}" for now; got "${providerId}". Pass deps.source from the pipeline.`,
    );
  }
  return {
    source: fakeSource.create({ options: {}, env: process.env, blob: undefined as never }),
    providerId,
  };
}

/**
 * Run IdeaSource.discover and insert only ideas that are not already in the inbox
 * (matched by sourceUrl, else title).
 *
 * Important: this module must not import the full provider registry — that pulls Remotion
 * into the Next.js dashboard bundle.
 */
export async function runDiscovery(deps: DiscoverDeps): Promise<DiscoverResult> {
  const { source, providerId } = resolveSource(deps);
  const found = await source.discover({ limit: deps.limit ?? 20 });
  const existing = await deps.listIdeas();
  const seen = new Set(existing.map((i) => dedupeKey(i)));

  const titles: string[] = [];
  let skipped = 0;
  for (const draft of found) {
    const key = dedupeKey(draft);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    const idea = await deps.insertIdea({ ...draft, status: "new", origin: "research" });
    seen.add(key);
    titles.push(idea.title);
  }
  return { added: titles.length, skipped, providerId, titles };
}
