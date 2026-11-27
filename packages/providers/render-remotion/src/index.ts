import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import {
  compositionDurationFrames,
  compositionDurationSec,
  defineManifest,
  newId,
  ProcessDiagram,
  nowIso,
  type BlobRef,
  type BlobStore,
  type ProviderContext,
  type Render,
  type RenderInput,
  type Renderer,
} from "@vcp/core";
import { FPS, HEIGHT, TEMPLATE_ID, TEMPLATE_VERSION, WIDTH, type FactShortProps } from "@vcp/renderer/props";
import { captionPositionFor, type CaptionPosition } from "./caption-placement";
import { startStaticServer } from "./static-server";
import { resolveSequences } from "./sequences";
import { createDockerSequenceWorker, type SequenceWorker } from "./sequence-worker";

export { createDockerSequenceWorker, dockerRunArgs, SequenceWorkerError, DEFAULT_LIMITS, type SequenceWorker } from "./sequence-worker";
export { resolveSequences, verifyIntermediate, intermediateKey, workerJob } from "./sequences";

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
  sequences: ReadonlyMap<string, { intermediate: BlobRef; startFrame: number; endFrame: number }> = new Map(),
): Promise<FactShortProps> {
  const placements = new Map<string, Promise<CaptionPosition>>();
  const scenes = await Promise.all(
    input.storyboard.scenes.map(async (scene) => {
      const asset = scene.assetId ? input.bundle[scene.assetId] : undefined;
      const diagram = scene.visual.kind === "diagram" ? ProcessDiagram.safeParse(scene.visual.spec) : undefined;
      const assetUrl = asset ? await urlFor(asset.blob) : undefined;
      // Preserve the vertical preference of storyboards saved with corner placements.
      let captionPosition: CaptionPosition | undefined = scene.captionPosition
        ? (scene.captionPosition.startsWith("top") ? "top" : "bottom")
        : undefined;
      if (!captionPosition && asset && assetUrl && (asset.kind === "image" || asset.kind === "video")) {
        const placementKey = `${asset.id}:${scene.end - scene.start}`;
        let placement = placements.get(placementKey);
        if (!placement) {
          placement = captionPositionFor(assetUrl, asset.kind,
            Math.min(asset.durationSec ?? scene.end - scene.start, scene.end - scene.start));
          placements.set(placementKey, placement);
        }
        captionPosition = await placement;
      }
      return {
        captionPosition: captionPosition ?? "bottom",
        beatId: scene.beatId,
        start: scene.start,
        end: scene.end,
        text: input.beats[scene.beatId] ?? "",
        kind: scene.visual.kind,
        animation: scene.visual.kind === "animation" ? scene.visual.plan : undefined,
        sequence: scene.visual.kind === "animationSequence"
          ? await sequenceProp(scene.visual.sequenceId, sequences, urlFor)
          : undefined,
        diagram: diagram?.success ? diagram.data : undefined,
        asset: asset
          ? { kind: asset.kind, url: assetUrl!, attribution: asset.attribution.text || undefined, durationSec: asset.durationSec }
          : undefined,
      };
    }),
  );
  return {
    title: input.title,
    // Leave a short hold for the audio tail beyond the last timed word.
    durationSec: compositionDurationSec(input.narration.durationSec, scenes.map((s) => s.end)),
    audioUrl: await urlFor(input.narration.audioBlob),
    words: input.narration.words,
    scenes,
    musicUrl,
  };
}

async function sequenceProp(
  sequenceId: string,
  sequences: ReadonlyMap<string, { intermediate: BlobRef; startFrame: number; endFrame: number }>,
  urlFor: (ref: BlobRef) => Promise<string>,
) {
  const resolved = sequences.get(sequenceId);
  if (!resolved) throw new Error(`Sequence ${sequenceId} was not resolved before rendering`);
  return { id: sequenceId, url: await urlFor(resolved.intermediate), startFrame: resolved.startFrame, endFrame: resolved.endFrame };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function createRemotionRenderer(
  blob: BlobStore,
  options: { concurrency?: number; sequenceWorker?: SequenceWorker; /** Remotion delayRender timeout; default 30s. */ timeoutMs?: number } = {},
): Renderer {
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
        const durationSec = compositionDurationSec(input.narration.durationSec, input.storyboard.scenes.map((s) => s.end));
        const sequences = input.storyboard.scenes.some((scene) => scene.visual.kind === "animationSequence")
          ? await resolveSequences(input, blob, options.sequenceWorker ?? createDockerSequenceWorker(), {
            fps: FPS,
            durationFrames: compositionDurationFrames(durationSec, FPS),
            profile: "full",
            captionPositions: Object.fromEntries(input.storyboard.scenes.map((scene) => [
              scene.beatId,
              scene.captionPosition?.startsWith("top") ? "top" as const : "bottom" as const,
            ])),
          })
          : new Map();
        const inputProps = await toFactShortProps(input, urlFor, musicUrl, sequences);
        const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable, timeoutInMilliseconds: options.timeoutMs });

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
          timeoutInMilliseconds: options.timeoutMs,
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
          timeoutInMilliseconds: options.timeoutMs,
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
