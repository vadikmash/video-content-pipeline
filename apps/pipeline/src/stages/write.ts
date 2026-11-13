import { ScriptDraft, newId, nowIso, type Claim, type Script } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";

/** Second pass: drop claims whose source is not in the brief or the idea's evidence. */
export function dropUnsourcedClaims(claims: Claim[], allowed: Set<string>): Claim[] {
  return claims.filter((c) => allowed.has(c.sourceUrl));
}

export const write = defineStage({
  name: "write",
  async input(ctx) {
    const brief = await ctx.store.latestBrief(ctx.project.id);
    if (!brief) throw new StageError("write: no brief for project", false);
    return { briefId: brief.id, ideaTitle: ctx.idea.title };
  },
  async run(ctx, input) {
    const { idea, ports, store, project } = ctx;
    const brief = await store.latestBrief(project.id);
    if (!brief || brief.id !== input.briefId) throw new StageError("write: brief changed under us", false);

    await limits.acquire(ports.TextModel.id);
    const draft = await ports.TextModel.generate(ScriptDraft, {
      kind: "script",
      system:
        "Write a 45-60 second vertical short. Hook in the first sentence. Every factual sentence must map to a claim. Copy claim sourceUrl values from the brief and the idea evidence. Do not invent URLs.",
      user: `Brief: ${brief.summary}\nAngle: ${brief.angle}`,
      context: { idea, brief },
    });

    const allowed = new Set([...brief.sources, ...idea.evidence.map((e) => e.url), idea.sourceUrl].filter(Boolean) as string[]);
    const claims = dropUnsourcedClaims(draft.claims, allowed);

    const script: Script = {
      ...draft,
      claims,
      id: newId(),
      projectId: project.id,
      ideaId: idea.id,
      version: await store.nextScriptVersion(project.id),
      provider: ports.TextModel.id,
      createdAt: nowIso(),
    };
    await store.insertScript(script);
    return {
      artifactId: script.id,
      summary: { version: script.version, beats: script.beats.length, claims: claims.length, dropped: draft.claims.length - claims.length },
    };
  },
});
