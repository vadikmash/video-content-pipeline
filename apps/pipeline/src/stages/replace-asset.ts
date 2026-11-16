import { nowIso, type EventData, type Storyboard } from "@vcp/core";
import { commitReplacement, getRender, getStoryboard, logEvent } from "@vcp/db";
import { registry } from "@vcp/providers";
import { dbStore } from "../store/db";
import { isSyntheticDepiction, resolveAsset } from "./assets";
import { StageError, canUseVisualProvider, loadStageCtx } from "./context";
import { renderStoryboard } from "./render";

export async function replaceReviewedAsset(input: EventData<"asset.replace">): Promise<void> {
  const { projectId, renderId, requestId, beatId, visual } = input;
  const gate = await dbStore.getStage(projectId, "approve-video");
  if (gate?.status !== "running" || gate.artifactId !== requestId) return;
  const ctx = await loadStageCtx(projectId, dbStore, registry);
  if (ctx.project.status !== "waiting" || ctx.project.currentStage !== "approve-video") return;
  const previousRender = await getRender(renderId);
  const previous = previousRender?.projectId === projectId ? await getStoryboard(previousRender.storyboardId) : undefined;
  const scene = previous?.scenes.find((item) => item.beatId === beatId);
  if (!previous || !scene || (scene.visual.kind !== "stock" && scene.visual.kind !== "still")) {
    throw new StageError("The original scene is no longer available", false);
  }
  const stock = canUseVisualProvider(ctx, "StockSearch");
  const still = canUseVisualProvider(ctx, "ImageGen");
  if ((visual.kind === "stock" && !stock) || (visual.kind === "still" && !still)) {
    throw new StageError("The requested visual provider is unavailable", false);
  }

  const asset = await resolveAsset(ctx.ports, projectId, { ...scene, visual }, still, requestId);
  if (visual.kind !== "type" && !asset) throw new StageError("No matching stock footage was found", false);
  if (asset) await dbStore.insertAsset(asset, projectId);

  const scenes = previous.scenes.map((item) =>
    item.beatId === beatId ? { ...item, visual, assetId: asset?.id } : item);
  const assets = new Map((await dbStore.getAssets(scenes.flatMap((item) => item.assetId ? [item.assetId] : [])))
    .map((item) => [item.id, item]));
  const board: Storyboard = {
    ...previous,
    id: requestId,
    version: await dbStore.nextStoryboardVersion(projectId),
    scenes,
    containsSyntheticMedia: scenes.some((item) => {
      const media = item.assetId ? assets.get(item.assetId) : undefined;
      return media !== undefined && isSyntheticDepiction(item.visual, media);
    }),
    provider: "user-edit",
    createdAt: nowIso(),
  };
  const render = await renderStoryboard(ctx, board);
  const committed = await commitReplacement(projectId, requestId, board, render);
  if (committed) {
    await logEvent(projectId, "asset.replaced", { beatId, storyboardId: board.id, renderId: render.id })
      .catch(() => {});
  }
}
