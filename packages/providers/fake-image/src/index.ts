import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineManifest, nowIso, type Asset, type ImageGen, type ProviderContext } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-image",
  port: "ImageGen",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "image", approxUsd: 0 },
  fake: true,
  description: "Copies a committed PNG fixture into the blob store for every prompt.",
});

export const FIXTURE_PATH = fileURLToPath(new URL("../fixtures/still.png", import.meta.url));

/** Styles that count as photoreal for the synthetic-media disclosure rule. */
export const PHOTOREAL_STYLES = new Set(["photo", "photoreal", "photorealistic", "realistic", "cinematic"]);

export function create(ctx: ProviderContext): ImageGen {
  return {
    id: manifest.id,
    async generate(prompt, opts) {
      const id = `fake-image-${createHash("sha1").update(prompt + (opts.style ?? "")).digest("hex").slice(0, 12)}`;
      const bytes = new Uint8Array(await readFile(FIXTURE_PATH));
      const blob = await ctx.blob.put(`generated/fake-image/${id}.png`, bytes, "image/png");
      const asset: Asset = {
        id,
        kind: "image",
        blob,
        provider: manifest.id,
        licence: "generated",
        attribution: { text: "Generated image (fake-image)", url: "" },
        width: opts.width ?? 540,
        height: opts.height ?? 960,
        synthetic: PHOTOREAL_STYLES.has((opts.style ?? "").toLowerCase()),
        createdAt: nowIso(),
      };
      return asset;
    },
  };
}
