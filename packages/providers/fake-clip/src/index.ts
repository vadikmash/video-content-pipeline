import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineManifest, nowIso, type Asset, type ClipGen, type ProviderContext } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-clip",
  port: "ClipGen",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "video", approxUsd: 0 },
  fake: true,
  description: "Copies a committed 3 s MP4 fixture into the blob store. Always marked synthetic.",
});

export const FIXTURE_PATH = fileURLToPath(new URL("../fixtures/clip.mp4", import.meta.url));

export function create(ctx: ProviderContext): ClipGen {
  return {
    id: manifest.id,
    async generate(prompt, seconds, opts) {
      const id = `fake-clip-${createHash("sha1").update(`${prompt}:${seconds}`).digest("hex").slice(0, 12)}`;
      const bytes = new Uint8Array(await readFile(FIXTURE_PATH));
      const blob = await ctx.blob.put(`generated/fake-clip/${id}.mp4`, bytes, "video/mp4");
      const asset: Asset = {
        id,
        kind: "video",
        blob,
        provider: manifest.id,
        licence: "generated",
        attribution: { text: "Generated clip (fake-clip)", url: "" },
        width: opts.width ?? 540,
        height: opts.height ?? 960,
        durationSec: 3,
        synthetic: true,
        createdAt: nowIso(),
      };
      return asset;
    },
  };
}
