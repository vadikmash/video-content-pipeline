import type { Asset, BlobStore, ResolvedPorts, Scene, VisualIntent } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";

const EXT: Record<string, string> = { "video/mp4": "mp4", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Stylised stills do not trigger the disclosure; photoreal depictions and clips do. */
export function isSyntheticDepiction(visual: VisualIntent, asset: Asset): boolean {
  if (visual.kind === "clip") return true;
  if (visual.kind === "still") return asset.synthetic;
  return false;
}

async function persist(blob: BlobStore, projectId: string, asset: Asset, bytes: Uint8Array): Promise<Asset> {
  const ext = EXT[asset.blob.contentType] ?? "bin";
  const ref = await blob.put(`projects/${projectId}/assets/${asset.id}.${ext}`, bytes, asset.blob.contentType);
  return { ...asset, blob: ref };
}

/** Preference order from the tech plan: stock -> still -> clip. */
export async function resolveAsset(
  ports: ResolvedPorts,
  projectId: string,
  scene: Scene,
): Promise<Asset | undefined> {
  const v = scene.visual;
  const seconds = Math.max(1, scene.end - scene.start);

  if (v.kind === "type" || v.kind === "diagram") return undefined;

  if (v.kind === "stock") {
    await limits.acquire(ports.StockSearch.id);
    const hits = await ports.StockSearch.search(v.query, { orientation: v.orientation, minDurationSec: seconds, perPage: 3 });
    const hit = hits[0];
    if (hit) {
      await limits.acquire(ports.StockSearch.id);
      const bytes = await ports.StockSearch.fetch(hit);
      return persist(ports.BlobStore, projectId, hit, bytes);
    }
    // Fall through to a stylised still when stock has nothing.
    await limits.acquire(ports.ImageGen.id);
    return ports.ImageGen.generate(v.query, { style: "flat-illustration", width: 1080, height: 1920 });
  }

  if (v.kind === "still") {
    await limits.acquire(ports.ImageGen.id);
    return ports.ImageGen.generate(v.prompt, { style: v.style, width: 1080, height: 1920 });
  }

  await limits.acquire(ports.ClipGen.id);
  return ports.ClipGen.generate(v.prompt, v.seconds, { width: 1080, height: 1920 });
}

export const assets = defineStage({
  name: "assets",
  async input(ctx) {
    const board = await ctx.store.latestStoryboard(ctx.project.id);
    if (!board) throw new StageError("assets: no storyboard for project", false);
    return { storyboardId: board.id, scenes: board.scenes.map((s) => ({ beatId: s.beatId, visual: s.visual })) };
  },
  async run(ctx, input) {
    const { ports, store, project } = ctx;
    const board = await store.latestStoryboard(project.id);
    if (!board || board.id !== input.storyboardId) throw new StageError("assets: storyboard changed under us", false);

    let synthetic = false;
    const scenes: Scene[] = [];
    for (const scene of board.scenes) {
      const asset = await resolveAsset(ports, project.id, scene);
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
