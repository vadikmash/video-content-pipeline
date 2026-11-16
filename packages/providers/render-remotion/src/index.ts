import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import {
  defineManifest,
  newId,
  nowIso,
  type BlobRef,
  type BlobStore,
  type ProviderContext,
  type Render,
  type RenderInput,
  type Renderer,
} from "@vcp/core";
import { FPS, HEIGHT, TEMPLATE_ID, TEMPLATE_VERSION, WIDTH, type FactShortProps } from "@vcp/renderer/props";
import { startStaticServer } from "./static-server";

export const manifest = defineManifest({
  id: "render-remotion",
  port: "Renderer",
  env: ["RENDERER_ENTRY"],
  limits: { concurrency: 1 },
  attributionRequired: false,
  costModel: { unit: "second", approxUsd: 0 },
  description: "Local Remotion render of the FactShort composition via @remotion/renderer.",
});

export const COMPOSITION_ID = "FactShort";

// ---------------------------------------------------------------------------
// Bundle cache (one webpack bundle per process)
// ---------------------------------------------------------------------------

let bundlePromise: Promise<string> | undefined;

export function resolveEntryPoint(): string {
  const fromEnv = process.env.RENDERER_ENTRY;
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    if (existsSync(abs)) return abs;
  }
  return fileURLToPath(import.meta.resolve("@vcp/renderer/entry"));
}

export function getBundle(): Promise<string> {
  if (!bundlePromise) {
    const entryPoint = resolveEntryPoint();
    bundlePromise = bundle({
      entryPoint,
      // Workspace packages are symlinked; let webpack follow them.
      webpackOverride: (config) => ({
        ...config,
        resolve: { ...config.resolve, symlinks: true },
      }),
    }).catch((err) => {
      bundlePromise = undefined;
      throw err;
    });
  }
  return bundlePromise;
}

// ---------------------------------------------------------------------------
// Props mapping
// ---------------------------------------------------------------------------

/** Music bed the user drops in. Gitignored; a missing file renders without music. */
export function resolveMusicBed(): string | undefined {
  const candidate = path.join(repoRoot(), "apps/renderer/public/bed.mp3");
  return existsSync(candidate) ? candidate : undefined;
}

function repoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export async function toFactShortProps(
  input: RenderInput,
  urlFor: (ref: BlobRef) => Promise<string>,
  musicUrl?: string,
): Promise<FactShortProps> {
  const scenes = await Promise.all(
    input.storyboard.scenes.map(async (scene) => {
      const asset = scene.assetId ? input.bundle[scene.assetId] : undefined;
      return {
        beatId: scene.beatId,
        start: scene.start,
        end: scene.end,
        text: input.beats[scene.beatId] ?? "",
        kind: scene.visual.kind,
        asset: asset
          ? { kind: asset.kind, url: await urlFor(asset.blob), attribution: asset.attribution.text || undefined }
          : undefined,
      };
    }),
  );
  const sources = [...new Set(Object.values(input.bundle).map((a) => a.attribution.url).filter(Boolean))];
  const lastEnd = Math.max(input.narration.durationSec, ...scenes.map((s) => s.end));
  return {
    title: input.title,
    durationSec: Math.max(1, Math.ceil((lastEnd + 2.5) * 10) / 10),
    audioUrl: await urlFor(input.narration.audioBlob),
    words: input.narration.words,
    scenes,
    sources: input.sources ?? sources,
    containsSyntheticMedia: input.storyboard.containsSyntheticMedia,
    musicUrl,
  };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function createRemotionRenderer(blob: BlobStore, options: { concurrency?: number } = {}): Renderer {
  return {
    id: manifest.id,
    async render(input) {
      const serveUrl = await getBundle();

      // Local blob stores get a loopback static server so Chromium can fetch assets.
      const localDir = blob.localRoot?.();
      const server = localDir ? await startStaticServer(localDir) : undefined;
      const urlFor = async (ref: BlobRef) =>
        server ? `${server.baseUrl}/${ref.key.split("/").map(encodeURIComponent).join("/")}` : blob.url(ref);

      const tmp = await mkdtemp(path.join(os.tmpdir(), "vcp-render-"));
      // Remotion caches its headless Chrome under <cwd>/node_modules/.remotion; allow pinning one copy.
      const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
      try {
        const bed = resolveMusicBed();
        const musicUrl = bed
          ? await urlFor(await blob.put("templates/fact-short/bed.mp3", new Uint8Array(await readFile(bed)), "audio/mpeg"))
          : undefined;
        const inputProps = await toFactShortProps(input, urlFor, musicUrl);
        const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable });

        const outVideo = path.join(tmp, "out.mp4");
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          outputLocation: outVideo,
          inputProps,
          concurrency: options.concurrency ?? 2,
          chromiumOptions: { gl: "angle" },
          browserExecutable,
        });

        const outStill = path.join(tmp, "thumb.jpeg");
        await renderStill({
          composition,
          serveUrl,
          output: outStill,
          inputProps,
          frame: Math.min(composition.durationInFrames - 1, Math.round(composition.fps * 1.5)),
          imageFormat: "jpeg",
          browserExecutable,
        });

        const id = newId();
        const base = `projects/${input.projectId}/renders/${id}`;
        const videoRef = await blob.put(`${base}.mp4`, new Uint8Array(await readFile(outVideo)), "video/mp4");
        const thumbRef = await blob.put(`${base}.jpg`, new Uint8Array(await readFile(outStill)), "image/jpeg");

        const render: Render = {
          id,
          projectId: input.projectId,
          storyboardId: input.storyboard.id,
          templateId: TEMPLATE_ID,
          templateVersion: TEMPLATE_VERSION,
          blob: videoRef,
          thumbnailBlob: thumbRef,
          durationSec: composition.durationInFrames / composition.fps,
          width: WIDTH,
          height: HEIGHT,
          fps: FPS,
          provider: manifest.id,
          createdAt: nowIso(),
        };
        return render;
      } finally {
        await server?.close();
        await rm(tmp, { recursive: true, force: true });
      }
    },
  };
}

export function create(ctx: ProviderContext): Renderer {
  return createRemotionRenderer(ctx.blob, {
    concurrency: typeof ctx.options.concurrency === "number" ? ctx.options.concurrency : undefined,
  });
}
