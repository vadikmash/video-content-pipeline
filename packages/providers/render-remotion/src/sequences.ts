/**
 * Resolve `animationSequence` scenes to verified visual-only intermediates.
 * Every ref must point inside the current project, every blob must match its
 * digest, and the manifest must still agree with the storyboard and narration.
 * Intermediates are reused by manifest digest and profile once verified.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getVideoMetadata } from "@remotion/renderer";
import {
  SequenceManifest,
  captionBox,
  sequencePrefix,
  sequenceSpans,
  sha256Hex,
  verifySequenceManifest,
  type BlobRef,
  type BlobStore,
  type RenderInput,
  type SequenceSpan,
} from "@vcp/core";
import { PROFILES, type Profile, type WorkerJob } from "@vcp/animation-worker/job";
import { CAPTION_LAYOUT } from "@vcp/renderer/props";
import type { SequenceWorker } from "./sequence-worker";

export interface ResolvedSequence {
  sequenceId: string;
  startFrame: number;
  endFrame: number;
  intermediate: BlobRef;
  cached: boolean;
}

export interface IntermediateRecord {
  manifestDigest: string;
  profile: Profile;
  frames: number;
  width: number;
  height: number;
  codec: string;
  sha256: string;
  bytes: number;
  image: string;
  imageId: string;
}

export function intermediateKey(projectId: string, sequenceId: string, manifestDigest: string, profile: Profile) {
  const file = PROFILES[profile].file;
  const base = `${sequencePrefix(projectId)}intermediates/${sequenceId}/${manifestDigest}-${profile}`;
  return { video: `${base}${path.extname(file)}`, record: `${base}.json` };
}

async function getVerified(blob: BlobStore, projectId: string, ref: { key: string; contentType?: string }, digest: string, what: string): Promise<Uint8Array> {
  if (!ref.key.startsWith(sequencePrefix(projectId)) || ref.key.includes("..")) throw new Error(`${what} ${ref.key} is outside project ${projectId}`);
  const bytes = await blob.get({ key: ref.key, contentType: ref.contentType ?? "application/octet-stream" });
  if (sha256Hex(bytes) !== digest) throw new Error(`${what} ${ref.key} does not match its digest`);
  return bytes;
}

async function tryGet(blob: BlobStore, ref: BlobRef): Promise<Uint8Array | undefined> {
  try {
    return await blob.get(ref);
  } catch {
    return undefined;
  }
}

/** Build the worker job for a verified manifest and its source. */
export function workerJob(manifest: SequenceManifest, source: string, span: SequenceSpan, profile: Profile, captionPositions: Record<string, "top" | "bottom">): WorkerJob {
  return {
    mode: "video",
    profile,
    source,
    sequence: {
      fps: manifest.fps,
      durationInFrames: manifest.endFrame - manifest.startFrame,
      seed: manifest.seed,
      cues: Object.fromEntries(manifest.cues.map((cue) => [cue.name, cue.localFrame])),
      beats: span.beats.map((beat) => ({
        id: beat.beatId,
        start: beat.start - manifest.startFrame,
        end: beat.end - manifest.startFrame,
        captionBox: captionBox(captionPositions[beat.beatId] ?? "bottom", CAPTION_LAYOUT),
      })),
      style: manifest.style,
      poses: manifest.poses,
    },
  };
}

/** Probe a returned video and accept it only with the expected shape and no audio. */
export async function verifyIntermediate(bytes: Uint8Array, expect: { profile: Profile; frames: number; fps: number }) {
  const spec = PROFILES[expect.profile];
  const dir = await mkdtemp(path.join(os.tmpdir(), "vcp-seq-probe-"));
  try {
    const file = path.join(dir, spec.file);
    await writeFile(file, bytes);
    const meta = await getVideoMetadata(file, { logLevel: "error" });
    const frames = Math.round((meta.durationInSeconds ?? 0) * meta.fps);
    const problems = [
      meta.width !== spec.width || meta.height !== spec.height ? `size ${meta.width}x${meta.height}, expected ${spec.width}x${spec.height}` : "",
      meta.fps !== expect.fps ? `fps ${meta.fps}, expected ${expect.fps}` : "",
      frames !== expect.frames ? `${frames} frames, expected ${expect.frames}` : "",
      meta.codec !== spec.codec ? `codec ${meta.codec}, expected ${spec.codec}` : "",
      meta.audioCodec !== null ? "an audio stream" : "",
    ].filter(Boolean);
    if (problems.length) throw new Error(`Sequence intermediate rejected: ${problems.join("; ")}`);
    return { frames, width: meta.width, height: meta.height, codec: meta.codec };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function resolveSequences(
  input: RenderInput,
  blob: BlobStore,
  worker: SequenceWorker | undefined,
  options: { fps: number; durationFrames: number; profile: Profile; captionPositions: Record<string, "top" | "bottom">; signal?: AbortSignal },
): Promise<Map<string, ResolvedSequence>> {
  const spans = sequenceSpans(input.storyboard.scenes, options.fps, options.durationFrames);
  const resolved = new Map<string, ResolvedSequence>();
  for (const span of spans) {
    const manifestBytes = await getVerified(blob, input.projectId, { key: span.manifest.key, contentType: "application/json" }, span.manifest.digest, "Sequence manifest");
    const manifest = SequenceManifest.parse(JSON.parse(new TextDecoder().decode(manifestBytes)));
    verifySequenceManifest(manifest, {
      projectId: input.projectId,
      span,
      narration: { id: input.storyboard.narrationId, words: input.narration.words },
      fps: options.fps,
    });
    const keys = intermediateKey(input.projectId, span.sequenceId, span.manifest.digest, options.profile);
    const spec = PROFILES[options.profile];
    const frames = manifest.endFrame - manifest.startFrame;

    const recordBytes = await tryGet(blob, { key: keys.record, contentType: "application/json" });
    if (recordBytes) {
      const record = JSON.parse(new TextDecoder().decode(recordBytes)) as IntermediateRecord;
      const video = await tryGet(blob, { key: keys.video, contentType: spec.contentType });
      if (video && record.manifestDigest === span.manifest.digest && record.frames === frames && sha256Hex(video) === record.sha256) {
        resolved.set(span.sequenceId, { sequenceId: span.sequenceId, startFrame: span.startFrame, endFrame: span.endFrame, intermediate: { key: keys.video, contentType: spec.contentType, size: video.byteLength }, cached: true });
        continue;
      }
    }

    if (!worker) throw new Error(`Sequence ${span.sequenceId} needs the sequence worker, which is not configured`);
    const source = new TextDecoder().decode(await getVerified(blob, input.projectId, { key: manifest.source.key, contentType: "text/plain" }, manifest.source.digest, "Sequence source"));
    const result = await worker.run(workerJob(manifest, source, span, options.profile, options.captionPositions), { signal: options.signal });
    const file = result.files.find((f) => f.name === spec.file);
    if (!file || result.files.length !== 1) throw new Error(`Sequence worker returned ${result.files.map((f) => f.name).join(", ") || "nothing"}, expected ${spec.file}`);
    const probe = await verifyIntermediate(file.bytes, { profile: options.profile, frames, fps: manifest.fps });
    const video = await blob.put(keys.video, new Uint8Array(file.bytes), spec.contentType);
    const record: IntermediateRecord = {
      manifestDigest: span.manifest.digest,
      profile: options.profile,
      ...probe,
      sha256: sha256Hex(file.bytes),
      bytes: file.bytes.length,
      image: result.image,
      imageId: result.imageId,
    };
    await blob.put(keys.record, new TextEncoder().encode(JSON.stringify(record, null, 2)), "application/json");
    resolved.set(span.sequenceId, { sequenceId: span.sequenceId, startFrame: span.startFrame, endFrame: span.endFrame, intermediate: video, cached: false });
  }
  return resolved;
}
