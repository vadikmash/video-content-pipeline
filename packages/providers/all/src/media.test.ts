import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import { create as createFlux } from "@vcp/provider-image-flux";
import { create as createPixabay } from "@vcp/provider-stock-pixabay";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(os.tmpdir(), "vcp-media-")); });
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

it("caches a Pixabay search across adapter instances and filters by duration and orientation", async () => {
  const variant = (id: number, width: number, height: number, duration: number) => ({
    id, duration, user: "creator", pageURL: `https://pixabay.com/videos/id-${id}/`, tags: "ocean, ai generated",
    videos: { medium: { url: `https://cdn.pixabay.com/video/${id}.mp4`, width, height } },
  });
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ hits: [variant(1, 1920, 1080, 20), variant(2, 1080, 1920, 1), variant(3, 1080, 1920, 20)] }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetch);
  const ctx = { options: {}, env: { PIXABAY_KEY: "test" }, blob: createLocalBlobStore({ dir }) };
  const opts = { orientation: "portrait", minDurationSec: 5 } as const;
  const stock = createPixabay(ctx);
  const hits = await stock.search("  ocean    waves ", opts);
  expect(hits.map((asset) => asset.id)).toEqual(["stock-pixabay-3"]);
  expect(hits[0]?.synthetic).toBe(true);
  expect(hits[0]?.attribution).toEqual({ text: "Video by creator on Pixabay", url: "https://pixabay.com/videos/id-3/" });
  expect(await createPixabay(ctx).search("ocean waves", { ...opts, minDurationSec: 25 })).toEqual([]);
  expect((await createPixabay(ctx).search("ocean waves", opts))[0]?.synthetic).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await stock.fetch(hits[0]!)).toEqual(new Uint8Array([1, 2, 3]));
  expect(String(fetch.mock.calls[1]?.[0])).toBe("https://cdn.pixabay.com/video/3.mp4");
});

it("resumes a submitted FLUX job after a polling failure and reuses the downloaded image", async () => {
  const pollingUrl = "https://api.eu.bfl.ai/v1/get_result?id=job";
  const sample = "https://delivery.bfl.ai/image.png";
  const png = readFileSync(new URL("../../fake-image/fixtures/still.png", import.meta.url));
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ polling_url: pollingUrl }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ status: "Ready", result: { sample } }))
    .mockResolvedValueOnce(new Response(new Uint8Array(png)));
  vi.stubGlobal("fetch", fetch);
  const ctx = { options: {}, env: { BFL_API_KEY: "test" }, blob: createLocalBlobStore({ dir }) };
  const opts = { requestId: "review-scene-1", style: "flat-illustration" };
  await expect(createFlux(ctx).generate("ocean", opts)).rejects.toMatchObject({ status: 503, retriable: true });
  const image = await createFlux(ctx).generate("ocean", opts);
  expect(image).toMatchObject({ width: 540, height: 960, synthetic: false });
  expect((await createFlux(ctx).generate("ocean", opts)).blob).toEqual(image.blob);
  expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
    "https://api.bfl.ai/v1/flux-2-klein-4b", pollingUrl, pollingUrl, sample,
  ]);
  const submission = fetch.mock.calls[0]?.[1];
  expect(JSON.parse(String(submission?.body))).toMatchObject({ width: 1088, height: 1920, output_format: "png" });
  const download = fetch.mock.calls[3]?.[1];
  expect(download?.headers).toBeUndefined();
});
