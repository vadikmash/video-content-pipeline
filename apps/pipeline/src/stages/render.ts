import type { AssetBundle, RenderInput } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";

export const TEMPLATE = { id: "fact-short", version: "1.0.0" } as const;

export const render = defineStage({
  name: "render",
  async input(ctx) {
    const board = await ctx.store.latestStoryboard(ctx.project.id);
    if (!board) throw new StageError("render: no storyboard for project", false);
    return { storyboardId: board.id, scenes: board.scenes, template: TEMPLATE };
  },
  async run(ctx, input) {
    const { ports, store, project, idea } = ctx;
    const board = await store.latestStoryboard(project.id);
    const narration = board ? await store.latestNarration(project.id) : undefined;
    const script = narration ? await store.getScript(narration.scriptId) : undefined;
    const brief = await store.latestBrief(project.id);
    if (!board || !narration || !script) throw new StageError("render: storyboard, narration or script missing", false);
    if (board.id !== input.storyboardId) throw new StageError("render: storyboard changed under us", false);

    const assetIds = board.scenes.map((s) => s.assetId).filter((id): id is string => Boolean(id));
    const bundle: AssetBundle = Object.fromEntries((await store.getAssets(assetIds)).map((a) => [a.id, a]));

    const beats: Record<string, string> = { hook: script.hook, outro: script.outro };
    for (const b of script.beats) beats[b.id] = b.text;

    const renderInput: RenderInput = {
      storyboard: board,
      bundle,
      template: TEMPLATE,
      narration: { audioBlob: narration.audioBlob, words: narration.words, durationSec: narration.durationSec },
      title: idea.title,
      beats,
      sources: brief?.sources ?? [],
      projectId: project.id,
    };

    await limits.acquire(ports.Renderer.id);
    const out = await ports.Renderer.render(renderInput);
    await store.insertRender(out);
    return { artifactId: out.id, summary: { durationSec: out.durationSec, provider: out.provider, key: out.blob.key } };
  },
});
