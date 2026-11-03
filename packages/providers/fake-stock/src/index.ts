import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineManifest, nowIso, type Asset, type ProviderContext, type StockSearch } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-stock",
  port: "StockSearch",
  env: [],
  limits: { perMinute: 100, cacheSeconds: 86_400 },
  attributionRequired: true,
  costModel: { unit: "request", approxUsd: 0 },
  fake: true,
  description: "Returns a committed portrait MP4 fixture for every query, with attribution.",
});

export const FIXTURE_PATH = fileURLToPath(new URL("../fixtures/portrait.mp4", import.meta.url));

function slug(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "query";
}

export function create(_ctx: ProviderContext): StockSearch {
  return {
    id: manifest.id,
    async search(q, opts) {
      const id = `fake-stock-${slug(q)}`;
      const asset: Asset = {
        id,
        kind: "video",
        blob: { key: `fixtures/fake-stock/portrait.mp4`, contentType: "video/mp4" },
        provider: manifest.id,
        licence: "Pixabay Content License (fake)",
        attribution: { text: `Video by Fake Stock for "${q}"`, url: "https://pixabay.com/" },
        width: 540,
        height: 960,
        durationSec: 4,
        synthetic: false,
        createdAt: nowIso(),
      };
      return Array.from({ length: Math.min(opts.perPage ?? 1, 3) }, (_, i) =>
        i === 0 ? asset : { ...asset, id: `${id}-${i + 1}` },
      );
    },
    async fetch() {
      return new Uint8Array(await readFile(FIXTURE_PATH));
    },
  };
}
