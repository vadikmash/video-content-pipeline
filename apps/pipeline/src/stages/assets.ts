import { inputHash, type Asset, type BlobStore, type ResolvedPorts, type Scene } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, canUseVisualProvider, defineStage } from "./context";

const EXT: Record<string, string> = { "video/mp4": "mp4", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Stylised stills do not trigger the disclosure; photoreal depictions and clips do. */
export function isSyntheticDepiction(visual: Scene["visual"], asset: Asset): boolean {
  return visual.kind === "clip" || asset.synthetic;
}

async function persist(blob: BlobStore, projectId: string, asset: Asset, bytes: Uint8Array): Promise<Asset> {
  const ext = EXT[asset.blob.contentType] ?? "bin";
  const id = inputHash({ projectId, assetId: asset.id, ...(asset.synthetic && { synthetic: true }) });
  const ref = await blob.put(`projects/${projectId}/assets/${id}.${ext}`, bytes, asset.blob.contentType);
  return { ...asset, id, blob: ref };
}

/** Preference order from the tech plan: stock -> still -> clip. */
export async function resolveAsset(
  ports: ResolvedPorts,
  projectId: string,
  scene: Scene,
  allowImageFallback = true,
  requestId?: string,
): Promise<Asset | undefined> {
  const v = scene.visual;
  const seconds = Math.max(1, scene.end - scene.start);
  const imageOptions = { width: 1080, height: 1920, requestId };

  if (v.kind === "type" || v.kind === "diagram" || v.kind === "animation" || v.kind === "animationSequence") return undefined;

  if (v.kind === "stock") {
    const hits = await ports.StockSearch.search(v.query, { orientation: v.orientation, minDurationSec: seconds, perPage: 3 });
    const hit = hits[0];
    if (hit) {
      const bytes = await ports.StockSearch.fetch(hit);
      return persist(ports.BlobStore, projectId, hit, bytes);
    }
    if (!allowImageFallback) return undefined;
    // Fall through to a stylised still when stock has nothing.
    return ports.ImageGen.generate(v.query, { ...imageOptions, style: "flat-illustration" });
  }

  if (v.kind === "still") {
    return ports.ImageGen.generate(v.prompt, { ...imageOptions, style: v.style });
  }

  await limits.acquire(ports.ClipGen.id);
  return ports.ClipGen.generate(v.prompt, v.seconds, { width: 1080, height: 1920 });
}

export const assets = defineStage({
  name: "assets",
  async input(ctx) {
    const board = await ctx.store.latestStoryboard(ctx.project.id);
    if (!board) throw new StageError("assets: no storyboard for project", false);
    return {
      storyboardId: board.id,
      scenes: board.scenes.map((s) => ({ beatId: s.beatId, visual: s.visual })),
      allowImageFallback: canUseVisualProvider(ctx, "ImageGen"),
      visualMode: ctx.project.visualMode,
    };
  },
  async run(ctx, input) {
    const { ports, store, project } = ctx;
    const board = await store.latestStoryboard(project.id);
    if (!board || board.id !== input.storyboardId) throw new StageError("assets: storyboard changed under us", false);
    if (input.visualMode === "animated" && board.scenes.some(scene => scene.visual.kind !== "animation" && scene.visual.kind !== "animationSequence")) {
      throw new StageError("Fully animated projects need an animation for every scene", false);
    }

    let synthetic = false;
    const scenes: Scene[] = [];
    for (const scene of board.scenes) {
      const requestId = inputHash({ storyboardId: board.id, beatId: scene.beatId, visual: scene.visual });
      const asset = await resolveAsset(ports, project.id, scene, input.allowImageFallback, requestId);
      if (asset) {
        await store.insertAsset(asset, project.id);
        if (isSyntheticDepiction(scene.visual, asset)) synthetic = true;
      }
      scenes.push({ ...scene, assetId: asset?.id });
    }

    await store.updateStoryboard(board.id, { scenes, containsSyntheticMedia: synthetic });
    return {
      artifactId: board.id,
      summary: { assets: scenes.filter((s) => s.assetId).length, containsSyntheticMedia: synthetic },
    };
  },
});
