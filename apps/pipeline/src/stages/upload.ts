import type { Asset, Brief, Idea, Storyboard, UploadMeta } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";
import { publishTarget } from "./destination";

export function buildUploadMeta(idea: Idea, brief: Brief | undefined, board: Storyboard, assets: Asset[]): UploadMeta {
  const attribution = assets
    .filter((a) => a.attribution.text)
    .map((a) => (a.attribution.url ? `${a.attribution.text} - ${a.attribution.url}` : a.attribution.text));
  const sources = brief?.sources ?? [];
  const description = [
    idea.oneLiner,
    "",
    ...(board.containsSyntheticMedia ? ["This video includes AI-generated visuals.", ""] : []),
    sources.length ? "Sources:" : "",
    ...sources.map((s) => `- ${s}`),
    attribution.length ? "" : "",
    attribution.length ? "Media:" : "",
    ...[...new Set(attribution)].map((a) => `- ${a}`),
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
  return {
    title: idea.title.slice(0, 100),
    description,
    tags: [idea.domain, "shorts", "facts"],
    containsSyntheticMedia: board.containsSyntheticMedia,
  };
}

export const upload = defineStage({
  name: "upload",
  async input(ctx) {
    const render = await ctx.store.latestRender(ctx.project.id);
    if (!render) throw new StageError("upload: no render for project", false);
    // The destination is part of the input: choosing another channel uploads again, to that channel.
    return { renderId: render.id, blobKey: render.blob.key, channelId: ctx.project.channelId ?? null };
  },
  async run(ctx, input) {
    const { ports, store, project, idea } = ctx;
    const render = await store.latestRender(project.id);
    const board = await store.latestStoryboard(project.id);
    const brief = await store.latestBrief(project.id);
    if (!render || !board || render.id !== input.renderId) throw new StageError("upload: render or storyboard missing", false);
    const channelId = input.channelId ?? undefined;
    const target = await publishTarget(ctx, channelId);

    const assetIds = board.scenes.map((s) => s.assetId).filter((id): id is string => Boolean(id));
    const assets = await store.getAssets(assetIds);
    const meta = buildUploadMeta(idea, brief, board, assets);

    // Idempotent per (render, channel): a retry after the row was saved returns it instead of uploading again.
    // (The provider covers the earlier window, where the remote upload finished but this row was not saved.)
    // Uploads to other channels are separate records and are left as they are.
    const existing = await store.findUpload(project.id, render.id, channelId);
    if (existing && existing.provider === ports.Publisher.id) {
      return {
        artifactId: existing.id,
        summary: {
          remoteId: existing.remoteId,
          channelId: existing.channelId ?? null,
          privacy: existing.privacy,
          containsSyntheticMedia: existing.containsSyntheticMedia,
          reused: true,
        },
      };
    }

    await limits.acquire(ports.Publisher.id);
    // Always private first; publishing is its own gated stage.
    const result = await ports.Publisher.upload(render, meta, "private", target);
    if (channelId && result.channelId !== channelId) {
      throw new StageError(`upload: publisher reported channel ${result.channelId ?? "none"}, expected ${channelId}`, false);
    }
    await store.insertUpload(result);
    return {
      artifactId: result.id,
      summary: { remoteId: result.remoteId, channelId: channelId ?? null, privacy: result.privacy, containsSyntheticMedia: meta.containsSyntheticMedia },
    };
  },
});
