/**
 * Model-facing schemas for authored sequences: the direction pass over the
 * whole script, one sequence's authored result, and a framed visual critique.
 * Records are expressed as arrays so strict structured-output schemas stay closed;
 * trusted code converts them to the manifest's shapes.
 */
import { z } from "zod";
import { CueBinding, MAX_CUE_OFFSET_FRAMES, MAX_SEQUENCE_SOURCE_BYTES, ObjectPose, type PoseSet } from "./animation";

const SequenceId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const ObjectId = z.string().regex(/^[a-z][a-zA-Z0-9-]{0,47}$/);
const ColorName = z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/);

export const DirectedSequence = z.object({
  sequenceId: SequenceId,
  /** Contiguous timed beats, in script order. */
  beatIds: z.array(z.string().min(1)).min(1).max(12),
  mechanism: z.string().min(1).max(500),
  objects: z.array(z.object({ id: ObjectId, role: z.string().min(1).max(200) })).max(12),
  framing: z.string().min(1).max(400),
  /** How this sequence starts relative to the previous one: continuous, or a planned cut with its purpose. */
  transitionIn: z.string().min(1).max(300),
  keyCues: z.array(z.string().min(1).max(80)).max(12),
});
export type DirectedSequence = z.infer<typeof DirectedSequence>;

export const SequenceDirection = z.object({
  styleNotes: z.string().min(1).max(600),
  palette: z.array(z.object({ name: ColorName, hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(2).max(16),
  sequences: z.array(DirectedSequence).min(1).max(12),
  /** The sequence that defines the mechanism; authored first. */
  mechanismSequenceId: SequenceId,
});
export type SequenceDirection = z.infer<typeof SequenceDirection>;

/** Every timed beat belongs to exactly one sequence, sequences are contiguous and in order. */
export function validateDirection(direction: SequenceDirection, timedBeatIds: readonly string[]): void {
  const flat = direction.sequences.flatMap((sequence) => sequence.beatIds);
  if (flat.length !== timedBeatIds.length || flat.some((beat, index) => beat !== timedBeatIds[index])) {
    throw new Error(`Direction must cover beats ${timedBeatIds.join(", ")} once each, in order; got ${flat.join(", ")}`);
  }
  const ids = new Set<string>();
  for (const sequence of direction.sequences) {
    if (ids.has(sequence.sequenceId)) throw new Error(`Sequence ${sequence.sequenceId} appears twice`);
    ids.add(sequence.sequenceId);
  }
  if (!ids.has(direction.mechanismSequenceId)) throw new Error(`Mechanism sequence ${direction.mechanismSequenceId} is not in the direction`);
}

export const PoseEntry = z.object({
  id: ObjectId,
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  scale: z.number(),
  rotate: z.number(),
});
export type PoseEntry = z.infer<typeof PoseEntry>;

export const SequenceAuthorDraft = z.object({
  description: z.string().min(1).max(300),
  cues: z.array(z.object({
    name: CueBinding.shape.name,
    word: z.number().int().nonnegative(),
    edge: z.enum(["start", "end"]),
    offsetFrames: z.number().int().min(-MAX_CUE_OFFSET_FRAMES).max(MAX_CUE_OFFSET_FRAMES),
  })).min(1).max(32),
  poses: z.object({ start: z.array(PoseEntry).min(1).max(24), end: z.array(PoseEntry).min(1).max(24) }),
  /** Complete TSX module: imports only from "react" and "@vcp/motion", one default export. */
  source: z.string().min(1).max(MAX_SEQUENCE_SOURCE_BYTES),
  /** What changed from the previous attempt and why; empty on the first attempt. */
  revisionNotes: z.string().max(1200),
});
export type SequenceAuthorDraft = z.infer<typeof SequenceAuthorDraft>;

/**
 * An all-zero size means "not on screen at this edge" (the first real draft
 * wrote absent objects that way); such entries are left out. Any other invalid
 * pose names its object so the author can fix it.
 */
export function poseSet(entries: readonly PoseEntry[], edge = "pose"): PoseSet {
  const out: PoseSet = {};
  for (const { id, ...pose } of entries) {
    if (out[id]) throw new Error(`${edge} pose for ${id} appears twice`);
    if (pose.width === 0 && pose.height === 0 && pose.scale === 0) continue;
    const parsed = ObjectPose.safeParse(pose);
    if (!parsed.success) {
      throw new Error(`${edge} pose for ${id}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
    }
    out[id] = parsed.data;
  }
  return out;
}

export const CRITIQUE_CRITERIA = ["mechanism", "art", "continuity", "motion", "delivery"] as const;
export type CritiqueCriterion = (typeof CRITIQUE_CRITERIA)[number];

export const CritiqueFinding = z.object({
  criterion: z.enum(CRITIQUE_CRITERIA),
  /** Global composition frame the observation refers to. */
  frame: z.number().int().nonnegative(),
  observed: z.string().min(1).max(500),
  change: z.string().max(500),
  verdict: z.enum(["pass", "revise"]),
});
export type CritiqueFinding = z.infer<typeof CritiqueFinding>;

export const SequenceCritique = z.object({
  findings: z.array(CritiqueFinding).min(CRITIQUE_CRITERIA.length).max(24),
  summary: z.string().min(1).max(800),
});
export type SequenceCritique = z.infer<typeof SequenceCritique>;

/** A sequence passes only when every criterion has a finding and none asks for revision. */
export function critiqueVerdict(critique: SequenceCritique): { verdict: "pass" | "revise"; failed: CritiqueCriterion[]; missing: CritiqueCriterion[] } {
  const missing = CRITIQUE_CRITERIA.filter((criterion) => !critique.findings.some((finding) => finding.criterion === criterion));
  const failed = CRITIQUE_CRITERIA.filter((criterion) => critique.findings.some((finding) => finding.criterion === criterion && finding.verdict === "revise"));
  return { verdict: failed.length || missing.length ? "revise" : "pass", failed, missing };
}
