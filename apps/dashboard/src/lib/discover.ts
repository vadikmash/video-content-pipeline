import type { Idea, NewIdea } from "@vcp/core";
import * as fakeSource from "@vcp/provider-fake-source";

function dedupeKey(idea: Pick<NewIdea, "title" | "sourceUrl">): string {
  return (idea.sourceUrl ?? idea.title).trim().toLowerCase();
}

export interface DiscoverResult {
  added: number;
  skipped: number;
  providerId: string;
  titles: string[];
}

/** Dashboard-local discovery — only touches fake-source so Next never loads Remotion. */
export async function discoverIdeasLocal(deps: {
  listIdeas: () => Promise<Idea[]>;
  insertIdea: (idea: NewIdea) => Promise<Idea>;
  limit?: number;
}): Promise<DiscoverResult> {
  const source = fakeSource.create({ options: {}, env: process.env, blob: undefined as never });
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
  return { added: titles.length, skipped, providerId: fakeSource.manifest.id, titles };
}
