import { BriefDraft, newId, nowIso, type Brief, type Idea, type SearchResult } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage, type StageCtx } from "./context";

/** A source counts when it is not the idea's origin post. User-supplied evidence counts. Opinion ideas skip the rule. */
export function hasIndependentSource(idea: Idea, sources: string[]): boolean {
  if (idea.opinion) return true;
  if (!idea.sourceUrl) return sources.length > 0;
  return sources.some((s) => s !== idea.sourceUrl);
}

function webResearchIsFake(ctx: StageCtx): boolean {
  const id = ctx.ports.WebResearch.id;
  return ctx.registry.manifests().some((m) => m.id === id && m.fake === true);
}

export const research = defineStage({
  name: "research",
  async input(ctx) {
    const { id, title, oneLiner, whySurprising, evidence, sourceUrl, opinion } = ctx.idea;
    return { ideaId: id, title, oneLiner, whySurprising, evidence, sourceUrl, opinion };
  },
  async run(ctx) {
    const { idea, ports, store, project } = ctx;
    const fake = webResearchIsFake(ctx);

    let results: SearchResult[] = [];
    const pages: { url: string; text: string }[] = [];
    if (fake) {
      const independent = idea.evidence.some((e) => e.url !== idea.sourceUrl);
      if (!idea.opinion && !independent) {
        throw new StageError(
          "research: add an evidence URL that is not the idea's origin, or mark the idea as opinion",
          false,
        );
      }
    } else {
      await limits.acquire(ports.WebResearch.id);
      results = await ports.WebResearch.search(idea.title);
      for (const r of results.slice(0, 2)) {
        await limits.acquire(ports.WebResearch.id);
        pages.push({ url: r.url, text: (await ports.WebResearch.fetch(r.url)).slice(0, 4000) });
      }
    }

    await limits.acquire(ports.TextModel.id);
    const draft = await ports.TextModel.generate(BriefDraft, {
      kind: "brief",
      system:
        "You research a short-video idea. Return a brief with verbatim evidence quotes. Every source URL must be copied from the context. Do not invent URLs.",
      user: `Idea: ${idea.title}\n${idea.oneLiner}\nWhy surprising: ${idea.whySurprising}`,
      context: fake ? { idea } : { idea, research: results, pages },
    });

    const known = new Set<string>([
      ...idea.evidence.map((e) => e.url),
      ...(idea.sourceUrl ? [idea.sourceUrl] : []),
      ...results.map((r) => r.url),
    ]);
    const sources = [
      ...new Set([
        ...draft.sources.filter((url) => known.has(url)),
        ...results.map((r) => r.url),
        ...idea.evidence.map((e) => e.url),
      ]),
    ];
    if (!hasIndependentSource(idea, sources)) {
      throw new StageError("originality: no source independent of the idea's origin was found", false);
    }

    const quoted = draft.evidence.filter((e) => known.has(e.url));
    const brief: Brief = {
      id: newId(),
      projectId: project.id,
      ideaId: idea.id,
      summary: draft.summary,
      angle: draft.angle,
      evidence: quoted.length ? quoted : idea.evidence,
      sources,
      provider: ports.TextModel.id,
      createdAt: nowIso(),
    };
    await store.insertBrief(brief);
    return {
      artifactId: brief.id,
      summary: { sources: sources.length, evidence: brief.evidence.length, searched: !fake },
    };
  },
});
