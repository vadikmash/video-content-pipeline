import { BriefDraft, newId, nowIso, type Brief, type Idea, type SearchResult } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";

/** Originality rule (b): at least one source that is not the idea's own origin post. */
export function hasIndependentSource(idea: Idea, sources: string[]): boolean {
  if (idea.opinion) return true;
  const own = new Set([idea.sourceUrl, ...idea.evidence.map((e) => e.url)].filter(Boolean));
  return sources.some((s) => !own.has(s));
}

export const research = defineStage({
  name: "research",
  async input(ctx) {
    const { id, title, oneLiner, whySurprising, evidence, sourceUrl, opinion } = ctx.idea;
    return { ideaId: id, title, oneLiner, whySurprising, evidence, sourceUrl, opinion };
  },
  async run(ctx) {
    const { idea, ports, store, project } = ctx;

    await limits.acquire(ports.WebResearch.id);
    const results: SearchResult[] = await ports.WebResearch.search(idea.title);
    const pages = await Promise.all(
      results.slice(0, 2).map(async (r) => {
        await limits.acquire(ports.WebResearch.id);
        return { url: r.url, text: (await ports.WebResearch.fetch(r.url)).slice(0, 4000) };
      }),
    );

    await limits.acquire(ports.TextModel.id);
    const draft = await ports.TextModel.generate(BriefDraft, {
      kind: "brief",
      system: "You research a short-video idea. Return a brief with verbatim evidence quotes and source URLs.",
      user: `Idea: ${idea.title}\n${idea.oneLiner}\nWhy surprising: ${idea.whySurprising}`,
      context: { idea, research: results, pages },
    });

    const sources = [...new Set([...draft.sources, ...results.map((r) => r.url)])];
    if (!hasIndependentSource(idea, sources)) {
      throw new StageError("originality: no source independent of the idea's origin was found", false);
    }

    const brief: Brief = {
      id: newId(),
      projectId: project.id,
      ideaId: idea.id,
      summary: draft.summary,
      angle: draft.angle,
      evidence: draft.evidence,
      sources,
      provider: ports.TextModel.id,
      createdAt: nowIso(),
    };
    await store.insertBrief(brief);
    return { artifactId: brief.id, summary: { sources: sources.length, evidence: brief.evidence.length } };
  },
});
