import { Storyboard, nowIso, type EventData } from "@vcp/core";
import {
  commitReplacement,
  getNarration,
  getRender,
  getScript,
  getStoryboard,
  logEvent,
} from "@vcp/db";
import { registry } from "@vcp/providers";
import { dbStore } from "../store/db";
import { planAnimatedScenes } from "./animation";
import { StageError, loadStageCtx } from "./context";
import { renderStoryboard } from "./render";
import { beatTimings } from "./storyboard";

export async function animateReviewedVideo({
  projectId,
  renderId,
  requestId,
}: EventData<"video.animate">): Promise<void> {
  const gate = await dbStore.getStage(projectId, "approve-video");
  if (gate?.status !== "running" || gate.artifactId !== requestId) return;
  const ctx = await loadStageCtx(projectId, dbStore, registry);
  const previousRender = await getRender(renderId);
  const previous =
    previousRender?.projectId === projectId
      ? await getStoryboard(previousRender.storyboardId)
      : undefined;
  if (
    !previous ||
    ctx.project.status !== "waiting" ||
    ctx.project.currentStage !== "approve-video"
  ) {
    throw new StageError("Video is unavailable for animation", false);
  }
  const narration = await getNarration(previous.narrationId);
  const script = narration ? await getScript(narration.scriptId) : undefined;
  if (!narration || !script)
    throw new StageError(
      "Animation needs the video's narration and script",
      false,
    );

  // Keep paid authoring output across a render retry.
  const cache = {
    key: `projects/${projectId}/animations/${requestId}.json`,
    contentType: "application/json",
  };
  let board: Storyboard;
  try {
    board = Storyboard.parse(
      JSON.parse(
        new TextDecoder().decode(await ctx.ports.BlobStore.get(cache)),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const scenes = await planAnimatedScenes(
      ctx,
      beatTimings(script, narration.words),
      narration,
      script,
      requestId,
    );
    board = {
      id: requestId,
      projectId,
      narrationId: narration.id,
      version: await dbStore.nextStoryboardVersion(projectId),
      scenes,
      containsSyntheticMedia: false,
      provider: ctx.ports.TextModel.id,
      createdAt: nowIso(),
    };
    await ctx.ports.BlobStore.put(
      cache.key,
      new TextEncoder().encode(JSON.stringify(board)),
      cache.contentType,
    );
  }
  const currentGate = await dbStore.getStage(projectId, "approve-video");
  if (currentGate?.status !== "running" || currentGate.artifactId !== requestId)
    return;
  const render = await renderStoryboard(ctx, board);
  if (
    await commitReplacement(projectId, requestId, board, render, "animated")
  ) {
    await logEvent(projectId, "video.animated", {
      storyboardId: board.id,
      renderId: render.id,
    }).catch(() => {});
  }
}
