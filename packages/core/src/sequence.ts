import { createHash } from "node:crypto";
import {
  MAX_SEQUENCE_SOURCE_BYTES,
  SEQUENCE_MANIFEST_VERSION,
  SequenceManifest,
  resolveCues,
  sequencePrefix,
  type CueBinding,
  type PoseSet,
  type SequenceSpan,
  type SequenceStyle,
} from "./animation";
import { canonicalJson } from "./hash";
import type { Word } from "./schemas";

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Digest of the word timings and frame rate a sequence was authored against. */
export function narrationTimingDigest(words: readonly Word[], fps: number): string {
  return sha256Hex(canonicalJson({ fps, words: words.map(({ text, start, end }) => ({ text, start, end })) }));
}

export function sequenceSourceKey(projectId: string, sequenceId: string, digest: string): string {
  return `${sequencePrefix(projectId)}sources/${sequenceId}/${digest}.tsx`;
}

export function sequenceManifestKey(projectId: string, sequenceId: string, digest: string): string {
  return `${sequencePrefix(projectId)}manifests/${sequenceId}/${digest}.json`;
}

export function manifestBytes(manifest: SequenceManifest): Uint8Array {
  return new TextEncoder().encode(canonicalJson(manifest));
}

export interface BuildSequenceManifestInput {
  projectId: string;
  sequenceId: string;
  description: string;
  span: Pick<SequenceSpan, "beatIds" | "startFrame" | "endFrame">;
  narration: { id: string; words: readonly Word[] };
  fps: number;
  cues: readonly CueBinding[];
  poses: { start: PoseSet; end: PoseSet };
  style: SequenceStyle;
  source: string;
  toolkitVersion: string;
  compilerVersion: string;
  seed: number;
}

/**
 * Trusted assembly of a manifest: assigns the source key, digests and global cue
 * frames. Returns the manifest plus the exact bytes to store for source and manifest.
 */
export function buildSequenceManifest(input: BuildSequenceManifestInput) {
  const sourceBytes = new TextEncoder().encode(input.source);
  if (sourceBytes.byteLength > MAX_SEQUENCE_SOURCE_BYTES) {
    throw new Error(`Sequence source is ${sourceBytes.byteLength} bytes; the limit is ${MAX_SEQUENCE_SOURCE_BYTES}`);
  }
  const sourceDigest = sha256Hex(sourceBytes);
  const manifest = SequenceManifest.parse({
    version: SEQUENCE_MANIFEST_VERSION,
    projectId: input.projectId,
    sequenceId: input.sequenceId,
    description: input.description,
    beatIds: [...input.span.beatIds],
    narration: { id: input.narration.id, timingDigest: narrationTimingDigest(input.narration.words, input.fps) },
    fps: input.fps,
    startFrame: input.span.startFrame,
    endFrame: input.span.endFrame,
    cues: resolveCues(input.cues, input.narration.words, input.fps, input.span),
    poses: input.poses,
    style: input.style,
    source: { key: sequenceSourceKey(input.projectId, input.sequenceId, sourceDigest), digest: sourceDigest, bytes: sourceBytes.byteLength },
    toolkitVersion: input.toolkitVersion,
    compilerVersion: input.compilerVersion,
    seed: input.seed,
  });
  const bytes = manifestBytes(manifest);
  const digest = sha256Hex(bytes);
  return {
    manifest,
    manifestBytes: bytes,
    manifestRef: { key: sequenceManifestKey(input.projectId, input.sequenceId, digest), digest },
    sourceBytes,
  };
}

/**
 * Check a stored manifest against the storyboard span and the narration it is
 * about to play with. Any drift (retimed narration, moved beats, edited cue
 * anchors) is an error rather than a silently misaligned picture.
 */
export function verifySequenceManifest(
  manifest: SequenceManifest,
  context: { projectId: string; span: SequenceSpan; narration: { id: string; words: readonly Word[] }; fps: number },
): void {
  const { span } = context;
  const fail = (why: string) => {
    throw new Error(`Sequence ${span.sequenceId}: ${why}`);
  };
  if (manifest.projectId !== context.projectId) fail("manifest belongs to another project");
  if (manifest.sequenceId !== span.sequenceId) fail(`manifest is for sequence ${manifest.sequenceId}`);
  if (!manifest.source.key.startsWith(sequencePrefix(context.projectId))) fail("source is outside the project");
  if (manifest.fps !== context.fps) fail(`manifest fps ${manifest.fps} differs from ${context.fps}`);
  if (manifest.beatIds.join(",") !== span.beatIds.join(",")) {
    fail(`manifest covers beats ${manifest.beatIds.join(", ")} but the storyboard has ${span.beatIds.join(", ")}`);
  }
  if (manifest.startFrame !== span.startFrame || manifest.endFrame !== span.endFrame) {
    fail(`manifest frames [${manifest.startFrame}, ${manifest.endFrame}) differ from storyboard frames [${span.startFrame}, ${span.endFrame})`);
  }
  if (manifest.narration.id !== context.narration.id) fail("manifest was authored for another narration");
  if (manifest.narration.timingDigest !== narrationTimingDigest(context.narration.words, context.fps)) {
    fail("narration timing changed since the sequence was authored");
  }
  const resolved = resolveCues(manifest.cues, context.narration.words, context.fps, span);
  resolved.forEach((cue, index) => {
    const stored = manifest.cues[index]!;
    if (cue.frame !== stored.frame || cue.localFrame !== stored.localFrame) fail(`cue ${cue.name} no longer resolves to frame ${stored.frame}`);
  });
}
