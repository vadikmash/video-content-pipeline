import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineManifest, newId, nowIso, type Preview, type ProviderContext, type Render, type Renderer } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-render",
  port: "Renderer",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "second", approxUsd: 0 },
  fake: true,
  description: "Copies a committed placeholder MP4 into the blob store. Instant; no Chromium.",
});

export const FIXTURE_PATH = fileURLToPath(new URL("../fixtures/placeholder.mp4", import.meta.url));
export const FRAME_FIXTURE_PATH = fileURLToPath(new URL("../fixtures/placeholder.jpg", import.meta.url));

export function create(ctx: ProviderContext): Renderer {
  return {
    id: manifest.id,
    async render(input) {
      const id = newId();
      const bytes = new Uint8Array(await readFile(FIXTURE_PATH));
      const blob = await ctx.blob.put(`projects/${input.projectId}/renders/${id}.mp4`, bytes, "video/mp4");
      const render: Render = {
        id,
        projectId: input.projectId,
        storyboardId: input.storyboard.id,
        templateId: input.template.id,
        templateVersion: input.template.version,
        blob,
        durationSec: 5,
        width: 540,
        height: 960,
        fps: 30,
        provider: manifest.id,
        createdAt: nowIso(),
      };
      return render;
    },
    async preview(input, options) {
      if (!Number.isInteger(options.startFrame) || options.endFrame <= options.startFrame) throw new Error("fake-render: empty preview range");
      const id = newId();
      const base = `projects/${input.projectId}/previews/${id}`;
      const video = await ctx.blob.put(`${base}/excerpt-${options.profile}.mp4`, new Uint8Array(await readFile(FIXTURE_PATH)), "video/mp4");
      const still = new Uint8Array(await readFile(FRAME_FIXTURE_PATH));
      const frames = [];
      for (const frame of options.frames ?? []) {
        if (frame < options.startFrame || frame >= options.endFrame) throw new Error(`fake-render: still ${frame} is outside the preview`);
        frames.push({ frame, timeSec: frame / 30, blob: await ctx.blob.put(`${base}/frame-${String(frame).padStart(6, "0")}.jpg`, still, "image/jpeg") });
      }
      const preview: Preview = {
        id,
        projectId: input.projectId,
        profile: options.profile,
        startFrame: options.startFrame,
        endFrame: options.endFrame,
        width: options.profile === "draft" ? 540 : 1080,
        height: options.profile === "draft" ? 960 : 1920,
        fps: 30,
        video,
        frames,
        provider: manifest.id,
        createdAt: nowIso(),
      };
      return preview;
    },
  };
}
