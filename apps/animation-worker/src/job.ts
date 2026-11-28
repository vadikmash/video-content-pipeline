import { z } from "zod";

/** Version of the worker image contract (wrapper, preflight, compiler settings). */
export const WORKER_VERSION = "1.0.0";
export const WORKER_IMAGE = `vcp-animation-worker:${WORKER_VERSION}`;
export const COMPOSITION_ID = "AuthoredSequence";
export const MAX_JOB_BYTES = 256 * 1024;
export const MAX_STILLS = 64;

const Rect = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
const Pose = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number(), scale: z.number(), rotate: z.number() });

/** Everything the authored module receives except the frame. Built by trusted code only. */
export const SequenceInput = z.object({
  fps: z.number().int().positive().max(120),
  durationInFrames: z.number().int().positive().max(30 * 120),
  seed: z.number().int().nonnegative(),
  cues: z.record(z.string(), z.number().int()),
  beats: z.array(z.object({ id: z.string(), start: z.number().int(), end: z.number().int(), captionBox: Rect })).min(1),
  style: z.object({ id: z.string(), palette: z.record(z.string(), z.string()), notes: z.string() }),
  poses: z.object({ start: z.record(z.string(), Pose), end: z.record(z.string(), Pose) }),
});
export type SequenceInput = z.infer<typeof SequenceInput>;

export const Profile = z.enum(["draft", "full"]);
export type Profile = z.infer<typeof Profile>;

export const PROFILES = {
  /** Small web-playable preview: H.264 at half scale. */
  draft: { scale: 0.5, width: 540, height: 960, codec: "h264", file: "visual.mp4", contentType: "video/mp4" },
  /** High-quality intraframe intermediate for final assembly. */
  full: { scale: 1, width: 1080, height: 1920, codec: "prores", file: "visual.mov", contentType: "video/quicktime" },
} as const;

export const WorkerJob = z.object({
  mode: z.enum(["video", "stills"]),
  profile: Profile,
  source: z.string().min(1),
  sequence: SequenceInput,
  /** Stills mode: local frames to render, in this order. */
  frames: z.array(z.number().int().nonnegative()).max(MAX_STILLS).optional(),
  concurrency: z.number().int().min(1).max(4).default(2),
});
export type WorkerJob = z.input<typeof WorkerJob>;
export type ParsedWorkerJob = z.infer<typeof WorkerJob>;

/** Diagnostic lines on stderr. Kept short; never include host paths or environment. */
export interface Diagnostic {
  stage: "job" | "preflight" | "typecheck" | "bundle" | "render" | "output";
  message: string;
  line?: number;
  column?: number;
}

/** Exit codes the host maps to error kinds. */
export const EXIT = { ok: 0, job: 2, preflight: 3, typecheck: 4, bundle: 5, render: 6, output: 7 } as const;
