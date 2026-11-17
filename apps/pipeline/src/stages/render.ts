import type { AssetBundle, RenderInput, Storyboard } from "@vcp/core";
import { limits } from "@vcp/limits";
import { TEMPLATE_ID, TEMPLATE_VERSION } from "@vcp/renderer/props";
import { StageError, defineStage, type StageCtx } from "./context";

export const TEMPLATE = { id: TEMPLATE_ID, version: TEMPLATE_VERSION } as const;

export const render = defineStage({
  name: "render",
  async input(ctx) {
    const board = await ctx.store.latestStoryboard(ctx.project.id);
    if (!board) throw new StageError("render: no storyboard for project", false);
    return { storyboardId: board.id, scenes: board.scenes, containsSyntheticMedia: board.containsSyntheticMedia, template: TEMPLATE };
  },
  async run(ctx, input) {
    const { store, project } = ctx;
    const board = await store.latestStoryboard(project.id);
    if (board?.id !== input.storyboardId) throw new StageError("render: storyboard changed or missing", false);
    const out = await renderStoryboard(ctx, board);
    await store.insertRender(out);
    return { artifactId: out.id, summary: { durationSec: out.durationSec, provider: out.provider, key: out.blob.key } };
  },
});

export async function renderStoryboard({ ports, store, project, idea }: StageCtx, board: Storyboard) {
  const narration = await store.latestNarration(project.id);
  const script = narration ? await store.getScript(narration.scriptId) : undefined;
  const brief = await store.latestBrief(project.id);
  if (narration?.id !== board.narrationId || !script) {
    throw new StageError("render: storyboard narration changed or script missing", false);
  }

  const assetIds = board.scenes.flatMap((scene) => scene.assetId ? [scene.assetId] : []);
  const bundle: AssetBundle = Object.fromEntries((await store.getAssets(assetIds)).map((asset) => [asset.id, asset]));

  const beats: Record<string, string> = { hook: script.hook, outro: script.outro };
  for (const beat of script.beats) beats[beat.id] = beat.text;

  const input: RenderInput = {
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
  return ports.Renderer.render(input);
}
