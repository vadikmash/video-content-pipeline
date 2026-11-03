import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineManifest, newId, nowIso, type ProviderContext, type Render, type Renderer } from "@vcp/core";

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
  };
}
