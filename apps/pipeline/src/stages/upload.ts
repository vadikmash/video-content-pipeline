import type { Asset, Brief, Idea, Storyboard, UploadMeta } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";

export function buildUploadMeta(idea: Idea, brief: Brief | undefined, board: Storyboard, assets: Asset[]): UploadMeta {
  const attribution = assets
    .filter((a) => a.attribution.text)
    .map((a) => (a.attribution.url ? `${a.attribution.text} - ${a.attribution.url}` : a.attribution.text));
  const sources = brief?.sources ?? [];
  const description = [
    idea.oneLiner,
    "",
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
    return { renderId: render.id, blobKey: render.blob.key };
  },
  async run(ctx, input) {
    const { ports, store, project, idea } = ctx;
    const render = await store.latestRender(project.id);
    const board = await store.latestStoryboard(project.id);
    const brief = await store.latestBrief(project.id);
    if (!render || !board || render.id !== input.renderId) throw new StageError("upload: render or storyboard missing", false);

    const assetIds = board.scenes.map((s) => s.assetId).filter((id): id is string => Boolean(id));
    const assets = await store.getAssets(assetIds);
    const meta = buildUploadMeta(idea, brief, board, assets);

    // Idempotent per render: a retry after the row was saved returns it instead of uploading again.
    // (The provider covers the earlier window, where the remote upload finished but this row was not saved.)
    const existing = await store.latestUpload(project.id);
    if (existing?.renderId === render.id && existing.provider === ports.Publisher.id) {
      return {
        artifactId: existing.id,
        summary: {
          remoteId: existing.remoteId,
          privacy: existing.privacy,
          containsSyntheticMedia: existing.containsSyntheticMedia,
          reused: true,
        },
      };
    }

    await limits.acquire(ports.Publisher.id);
    // Always private first; publishing is its own gated stage.
    const result = await ports.Publisher.upload(render, meta, "private");
    await store.insertUpload(result);
    return { artifactId: result.id, summary: { remoteId: result.remoteId, privacy: result.privacy, containsSyntheticMedia: meta.containsSyntheticMedia } };
  },
});
