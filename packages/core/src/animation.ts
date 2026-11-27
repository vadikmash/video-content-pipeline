import { z } from "zod";

const Color = z.string().regex(/^(#[0-9a-fA-F]{6}|none)$/);
const Coordinate = z.number().finite().min(-1920).max(1920);

export const VectorNode = z.object({
  id: z.string().min(1).max(60),
  parentId: z.string().nullable(),
  x: Coordinate,
  y: Coordinate,
  fill: Color,
  stroke: Color,
  strokeWidth: z.number().min(0).max(24),
  shape: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("group") }),
    z.object({
      kind: z.literal("ellipse"),
      rx: z.number().positive().max(700),
      ry: z.number().positive().max(700),
    }),
    z.object({
      kind: z.literal("rect"),
      width: z.number().positive().max(1080),
      height: z.number().positive().max(1200),
      radius: z.number().min(0).max(200),
    }),
    z.object({
      kind: z.literal("path"),
      d: z
        .string()
        .min(1)
        .max(2400)
        .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\s-]+$/),
    }),
    z.object({
      kind: z.literal("text"),
      text: z.string().min(1).max(32),
      fontSize: z.number().min(26).max(64),
    }),
  ]),
});

export const MotionProperty = z.enum([
  "x",
  "y",
  "scale",
  "rotate",
  "opacity",
  "draw",
]);
const Anchor = z.object({
  word: z.number().int().nonnegative(),
  edge: z.enum(["start", "end"]),
  value: z.number().finite().min(-1920).max(1920),
});

/** Model-authored geometry and word anchors. The pipeline resolves times before rendering. */
export const AnimationDraft = z.object({
  description: z.string().min(1).max(300),
  nodes: z.array(VectorNode).min(2).max(60),
  tracks: z
    .array(
      z.object({
        nodeId: z.string(),
        property: MotionProperty,
        keyframes: z.array(Anchor).min(2).max(8),
      }),
    )
    .min(1)
    .max(80),
});
export type AnimationDraft = z.infer<typeof AnimationDraft>;

export const VectorAnimation = z.object({
  version: z.literal(1),
  description: z.string(),
  nodes: z.array(VectorNode).min(2).max(60),
  tracks: z
    .array(
      z.object({
        nodeId: z.string(),
        property: MotionProperty,
        keyframes: z
          .array(
            z.object({
              time: z.number().nonnegative(),
              value: z.number().finite(),
            }),
          )
          .min(2)
          .max(8),
      }),
    )
    .min(1)
    .max(80),
});
export type VectorAnimation = z.infer<typeof VectorAnimation>;

export function validateAnimationStructure(
  plan: Pick<AnimationDraft, "nodes" | "tracks">,
): void {
  const nodes = new Map<string, z.infer<typeof VectorNode>>();
  for (const node of plan.nodes) {
    if (nodes.has(node.id)) throw new Error(`Duplicate vector node ${node.id}`);
    if (
      node.parentId !== null &&
      nodes.get(node.parentId)?.shape.kind !== "group"
    ) {
      throw new Error(`Parent of ${node.id} must be an earlier group`);
    }
    nodes.set(node.id, node);
  }
  if (
    !plan.nodes.some(
      (node) => node.shape.kind !== "group" && node.shape.kind !== "text",
    )
  ) {
    throw new Error("An animated scene needs illustrated objects");
  }
  const tracks = new Set<string>();
  for (const track of plan.tracks) {
    const node = nodes.get(track.nodeId);
    const key = `${track.nodeId}:${track.property}`;
    if (!node || tracks.has(key))
      throw new Error(`Invalid or duplicate motion track ${key}`);
    if (track.property === "draw" && node.shape.kind !== "path")
      throw new Error("Stroke draw requires a path");
    for (const frame of track.keyframes) {
      if (
        ["opacity", "draw"].includes(track.property) &&
        (frame.value < 0 || frame.value > 1)
      )
        throw new Error(`${key} must stay between zero and one`);
      if (track.property === "scale" && (frame.value < 0 || frame.value > 5))
        throw new Error(`${key} must stay between zero and five`);
    }
    tracks.add(key);
  }
}

// ---------------------------------------------------------------------------
// Authored animation sequences (M2.5)
//
// A sequence is one authored TSX module that owns the visual layer for one or
// more adjacent beats. Model output supplies source, cue names and poses;
// trusted code assigns keys, digests and frame ranges. Everything here is
// browser-safe; digests live in `sequence.ts`.
// ---------------------------------------------------------------------------

export const SEQUENCE_MANIFEST_VERSION = 1;
/** Bounded signed offset for anticipation and follow-through around a cue. */
export const MAX_CUE_OFFSET_FRAMES = 30;
export const MAX_SEQUENCE_SOURCE_BYTES = 64 * 1024;

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const SequenceId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const CueName = z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/);
const ObjectId = z.string().regex(/^[a-z][a-zA-Z0-9-]{0,47}$/);
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** A named moment bound to one narration word edge, before quantization. */
export const CueBinding = z.object({
  name: CueName,
  word: z.number().int().nonnegative(),
  edge: z.enum(["start", "end"]),
  offsetFrames: z.number().int().min(-MAX_CUE_OFFSET_FRAMES).max(MAX_CUE_OFFSET_FRAMES).default(0),
});
export type CueBinding = z.infer<typeof CueBinding>;

/** Cue after trusted resolution: `frame` is global, `localFrame` relative to the sequence start. */
export const ResolvedCue = CueBinding.extend({
  frame: z.number().int().nonnegative(),
  localFrame: z.number().int().nonnegative(),
});
export type ResolvedCue = z.infer<typeof ResolvedCue>;

/** Pose of a persistent object in 1080x1920 design coordinates; `width`/`height` bound its key geometry. */
export const ObjectPose = z.object({
  x: z.number().finite().min(-1920).max(3000),
  y: z.number().finite().min(-1920).max(3840),
  width: z.number().positive().max(4000),
  height: z.number().positive().max(4000),
  scale: z.number().positive().max(10).default(1),
  rotate: z.number().min(-360).max(360).default(0),
});
export type ObjectPose = z.infer<typeof ObjectPose>;
export const PoseSet = z.record(ObjectId, ObjectPose).refine((poses) => Object.keys(poses).length <= 24, "At most 24 posed objects");
export type PoseSet = z.infer<typeof PoseSet>;

export const SequenceStyle = z.object({
  id: z.string().min(1).max(64),
  palette: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/), Hex).refine((p) => Object.keys(p).length <= 16, "At most 16 colors"),
  notes: z.string().max(600).default(""),
});
export type SequenceStyle = z.infer<typeof SequenceStyle>;

export const SequenceSourceRef = z.object({
  key: z.string().min(1),
  digest: Sha256,
  bytes: z.number().int().positive().max(MAX_SEQUENCE_SOURCE_BYTES),
});

export const SequenceManifest = z.object({
  version: z.literal(SEQUENCE_MANIFEST_VERSION),
  projectId: z.string().min(1),
  sequenceId: SequenceId,
  description: z.string().min(1).max(300),
  beatIds: z.array(z.string().min(1)).min(1).max(32),
  narration: z.object({ id: z.string().min(1), timingDigest: Sha256 }),
  fps: z.number().int().positive().max(120),
  /** Global composition frames, half-open. */
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  cues: z.array(ResolvedCue).max(32),
  poses: z.object({ start: PoseSet, end: PoseSet }),
  style: SequenceStyle,
  source: SequenceSourceRef,
  toolkitVersion: z.string().min(1),
  compilerVersion: z.string().min(1),
  seed: z.number().int().nonnegative().max(2 ** 31 - 1),
});
export type SequenceManifest = z.infer<typeof SequenceManifest>;

/** Persisted pointer from a beat to an immutable, project-scoped sequence manifest. */
export const AnimationSequenceRef = z.object({
  kind: z.literal("animationSequence"),
  sequenceId: SequenceId,
  manifest: z.object({ key: z.string().min(1), digest: Sha256 }),
  description: z.string().min(1).max(300),
});
export type AnimationSequenceRef = z.infer<typeof AnimationSequenceRef>;

export function sequencePrefix(projectId: string): string {
  return `projects/${projectId}/animations/`;
}

interface TimedWord { start: number; end: number }
interface TimedScene { beatId: string; start: number; visual: { kind: string } }

/** A word edge rounded to a composition frame (rounded before subtracting any sequence start). */
export function wordEdgeFrame(words: readonly TimedWord[], word: number, edge: "start" | "end", fps: number): number {
  const timed = words[word];
  if (!timed) throw new Error(`Cue word ${word} is outside the narration (${words.length} words)`);
  return Math.max(0, Math.round(timed[edge] * fps));
}

/**
 * Beat intervals in frames using the renderer's visual-timeline policy: the first
 * beat starts at frame zero, each beat ends where the next starts, and the last
 * beat holds through the audio tail to `durationFrames`.
 */
export function beatFrameIntervals<S extends TimedScene>(scenes: readonly S[], fps: number, durationFrames: number) {
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  return sorted.flatMap((scene, index) => {
    const start = index === 0 ? 0 : Math.max(0, Math.round(scene.start * fps));
    const next = sorted[index + 1];
    const end = next ? Math.min(durationFrames, Math.round(next.start * fps)) : durationFrames;
    return end > start ? [{ scene, beatId: scene.beatId, start, end }] : [];
  });
}

export interface SequenceSpan {
  sequenceId: string;
  manifest: { key: string; digest: string };
  beatIds: string[];
  startFrame: number;
  endFrame: number;
  /** Per-beat intervals inside the sequence, kept for caption placement. */
  beats: { beatId: string; start: number; end: number }[];
}

/**
 * Collapse adjacent beats that reference the same sequence into one span.
 * Rejects noncontiguous reuse, one sequence ID with several manifests, and
 * beats that collapse to zero frames.
 */
export function sequenceSpans<S extends TimedScene>(scenes: readonly S[], fps: number, durationFrames: number): SequenceSpan[] {
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  const intervals = beatFrameIntervals(sorted, fps, durationFrames);
  const byBeat = new Map(intervals.map((interval) => [interval.beatId, interval]));
  const seenBeats = new Set<string>();
  const spans: SequenceSpan[] = [];
  const closed = new Set<string>();
  let open: SequenceSpan | undefined;
  for (const scene of sorted) {
    if (seenBeats.has(scene.beatId)) throw new Error(`Beat ${scene.beatId} appears twice in the storyboard`);
    seenBeats.add(scene.beatId);
    const ref = scene.visual.kind === "animationSequence" ? AnimationSequenceRef.parse(scene.visual) : undefined;
    if (!ref) {
      if (open) closed.add(open.sequenceId);
      open = undefined;
      continue;
    }
    const interval = byBeat.get(scene.beatId);
    if (!interval) throw new Error(`Beat ${scene.beatId} in sequence ${ref.sequenceId} has no frames`);
    if (open && open.sequenceId === ref.sequenceId) {
      if (open.manifest.digest !== ref.manifest.digest || open.manifest.key !== ref.manifest.key) {
        throw new Error(`Sequence ${ref.sequenceId} references two manifests`);
      }
      if (interval.start !== open.endFrame) throw new Error(`Sequence ${ref.sequenceId} has a gap before ${scene.beatId}`);
      open.beatIds.push(scene.beatId);
      open.beats.push({ beatId: scene.beatId, start: interval.start, end: interval.end });
      open.endFrame = interval.end;
      continue;
    }
    if (open) closed.add(open.sequenceId);
    if (closed.has(ref.sequenceId) || spans.some((span) => span.sequenceId === ref.sequenceId)) {
      throw new Error(`Sequence ${ref.sequenceId} is reused by noncontiguous beats`);
    }
    open = {
      sequenceId: ref.sequenceId,
      manifest: ref.manifest,
      beatIds: [scene.beatId],
      startFrame: interval.start,
      endFrame: interval.end,
      beats: [{ beatId: scene.beatId, start: interval.start, end: interval.end }],
    };
    spans.push(open);
  }
  return spans;
}

/** Resolve cue bindings against the narration for a sequence span. */
export function resolveCues(
  bindings: readonly CueBinding[],
  words: readonly TimedWord[],
  fps: number,
  span: { startFrame: number; endFrame: number },
): ResolvedCue[] {
  const names = new Set<string>();
  return bindings.map((binding) => {
    const parsed = CueBinding.parse(binding);
    if (names.has(parsed.name)) throw new Error(`Duplicate cue ${parsed.name}`);
    names.add(parsed.name);
    const frame = wordEdgeFrame(words, parsed.word, parsed.edge, fps) + parsed.offsetFrames;
    if (frame < span.startFrame || frame >= span.endFrame) {
      throw new Error(`Cue ${parsed.name} lands on frame ${frame}, outside sequence frames [${span.startFrame}, ${span.endFrame})`);
    }
    return { ...parsed, frame, localFrame: frame - span.startFrame };
  });
}

/**
 * Require cues in a given order. Anchors that quantize to the same frame pass
 * unless `strict` is set, in which case each must land strictly later.
 */
export function assertCueOrder(cues: readonly ResolvedCue[], order: readonly string[], strict = false): void {
  const byName = new Map(cues.map((cue) => [cue.name, cue]));
  for (let i = 1; i < order.length; i++) {
    const before = byName.get(order[i - 1]!);
    const after = byName.get(order[i]!);
    if (!before || !after) throw new Error(`Missing cue ${before ? order[i] : order[i - 1]}`);
    if (strict ? after.frame <= before.frame : after.frame < before.frame) {
      throw new Error(`Cue ${after.name} (frame ${after.frame}) must follow ${before.name} (frame ${before.frame})`);
    }
  }
}

/** Composition length shared by the renderer adapter and manifest validation. */
export function compositionDurationSec(narrationDurationSec: number, sceneEnds: readonly number[]): number {
  const lastEnd = Math.max(narrationDurationSec, ...sceneEnds);
  return Math.max(1, Math.ceil((lastEnd + 0.25) * 10) / 10);
}

export function compositionDurationFrames(durationSec: number, fps: number): number {
  return Math.max(fps, Math.round(durationSec * fps));
}

/** Caption boxes (design coordinates) the visual layer must keep clear, from the trusted caption layout. */
export function captionBox(position: "top" | "bottom", layout: { top: number; bottom: number; fontSize: number }, size = { width: 1080, height: 1920 }, lines = 2) {
  const center = size.height * layout[position];
  const lineHeight = layout.fontSize * 1.38 + 12 + 12;
  const half = (lines * lineHeight) / 2;
  return { x: size.width / 12, y: center - half, width: size.width * (10 / 12), height: half * 2 };
}

export function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Axis-aligned bounds of a pose (centered at x/y, scaled). */
export function poseBounds(pose: ObjectPose) {
  const width = pose.width * pose.scale;
  const height = pose.height * pose.scale;
  return { x: pose.x - width / 2, y: pose.y - height / 2, width, height };
}
