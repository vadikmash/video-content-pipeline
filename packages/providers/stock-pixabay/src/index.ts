import { createHash } from "node:crypto";
import { ProviderError, defineManifest, nowIso, type Asset, type ProviderContext, type StockSearch } from "@vcp/core";
import { Deferred, limits, parseRetryAfter } from "@vcp/limits";
import { z } from "zod";

const CACHE_SECONDS = 86_400;

export const manifest = defineManifest({
  id: "stock-pixabay",
  port: "StockSearch",
  env: ["PIXABAY_KEY"],
  limits: { perMinute: 100, cacheSeconds: CACHE_SECONDS, concurrency: 2 },
  attributionRequired: true,
  costModel: { unit: "request", approxUsd: 0 },
  description: "Finds Pixabay video footage and downloads selected clips to the project.",
});

const rendition = z.object({ url: z.string(), width: z.number().int(), height: z.number().int() });
const searchResult = z.object({
  hits: z.array(z.object({
    id: z.number().int(),
    pageURL: z.url(),
    duration: z.number().positive(),
    user: z.string(),
    tags: z.string().optional(),
    videos: z.record(z.string(), rendition),
  })),
});
const cacheEntry = searchResult.extend({ savedAt: z.number() });

function downloadUrl(value: string): URL | undefined {
  if (!URL.canParse(value)) return undefined;
  const url = new URL(value);
  if (url.origin === "https://cdn.pixabay.com" && url.pathname.endsWith(".mp4")) return url;
}

export function create(ctx: ProviderContext): StockSearch {
  const apiKey = ctx.env.PIXABAY_KEY;

  return {
    id: manifest.id,
    async search(query, opts) {
      if (!apiKey) throw new ProviderError("PIXABAY_KEY is missing", 401);
      const q = Array.from(query.trim().replace(/\s+/g, " ")).slice(0, 100).join("");
      if (!q) return [];
      const params = new URLSearchParams({ q, safesearch: "true", per_page: "30" });
      const hash = createHash("sha256").update(apiKey).update("\0").update(params.toString()).digest("hex");
      const cacheRef = { key: `cache/stock-pixabay/v2/${hash}.json`, contentType: "application/json" };
      let result: z.infer<typeof searchResult> | undefined;
      try {
        const data = cacheEntry.safeParse(JSON.parse(new TextDecoder().decode(await ctx.blob.get(cacheRef))));
        if (data.success && Date.now() - data.data.savedAt < CACHE_SECONDS * 1000) result = data.data;
      } catch (error) {
        if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      if (!result) {
        params.set("key", apiKey);
        await limits.acquire(manifest.id);
        const response = await fetch(`https://pixabay.com/api/videos/?${params}`, {
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        }).catch(() => { throw new ProviderError("Pixabay video search request failed"); });
        const headers = Object.fromEntries(response.headers);
        await limits.observe(manifest.id, headers);
        if (response.status === 429) {
          const reset = parseRetryAfter(headers["x-ratelimit-reset"]) ?? 60_000;
          const wait = parseRetryAfter(headers["retry-after"]) ?? reset;
          await limits.trip(manifest.id, new Date(Date.now() + wait), "Pixabay rate limit reached");
          throw new Deferred(manifest.id, wait, "Pixabay rate limit reached");
        }
        if (!response.ok) throw new ProviderError(`Pixabay video search failed (HTTP ${response.status})`, response.status);
        result = searchResult.parse(await response.json());
        const bytes = new TextEncoder().encode(JSON.stringify({ ...result, savedAt: Date.now() }));
        await ctx.blob.put(cacheRef.key, bytes, cacheRef.contentType);
      }

      const matches: Asset[] = [];
      for (const video of result.hits) {
        if (video.duration < (opts.minDurationSec ?? 0)) continue;
        const variant = ["medium", "large", "small", "tiny"].map((size) => video.videos[size]).find((v) => {
          if (!v || v.width <= 0 || v.height <= 0 || !downloadUrl(v.url)) return false;
          if (opts.orientation === "portrait") return v.height > v.width;
          if (opts.orientation === "landscape") return v.width > v.height;
          if (opts.orientation === "square") return v.width === v.height;
          return true;
        });
        if (!variant) continue;
        matches.push({
          id: `stock-pixabay-${video.id}`,
          kind: "video",
          blob: { key: variant.url, contentType: "video/mp4" },
          provider: manifest.id,
          licence: "Pixabay Content License",
          attribution: { text: video.user ? `Video by ${video.user} on Pixabay` : "Video from Pixabay", url: video.pageURL },
          width: variant.width,
          height: variant.height,
          durationSec: video.duration,
          synthetic: video.tags?.split(",").some((tag) => /^ai[\s-]+generated$/i.test(tag.trim())) ?? false,
          createdAt: nowIso(),
        });
      }
      return matches.slice(0, opts.perPage ?? 3);
    },
    async fetch(asset) {
      const url = downloadUrl(asset.blob.key);
      if (asset.provider !== manifest.id || !url) throw new ProviderError("Invalid Pixabay video download URL", 400);
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(45_000) })
        .catch(() => { throw new ProviderError("Pixabay video download request failed"); });
      if (!response.ok) throw new ProviderError(`Pixabay video download failed (HTTP ${response.status})`, response.status);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
