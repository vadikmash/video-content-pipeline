/**
 * Trusted, topic-independent motion toolkit for authored sequences. Authored
 * modules import only `react` and this module (as `@vcp/motion`). Everything is
 * a pure function of the frame, so any frame renders directly in any order.
 */
import React from "react";

export const TOOLKIT_VERSION = "1.0.0";
export const DESIGN = { width: 1080, height: 1920 } as const;

export { ease, tween, settle, anticipate, cueFrame, type Ease, type Key } from "./timing";
export { random, randomRange } from "./random";
export { burst, MAX_PARTICLES, MAX_PARTICLE_LIFETIME, type BurstOptions, type Particle } from "./particles";
export { parsePath, morphPath, morphIncompatibility, type PathShape } from "./morph";
export { cameraAt, cameraTransform, projectPoint, type CameraKey, type CameraPose } from "./camera";

export interface Rect { x: number; y: number; width: number; height: number }
export interface Pose { x: number; y: number; width: number; height: number; scale: number; rotate: number }

/** Props every authored sequence receives. Frames are local to the sequence. */
export interface SequenceProps {
  frame: number;
  fps: number;
  durationInFrames: number;
  /** Always the 1080x1920 design space; drafts are scaled by the trusted wrapper. */
  width: number;
  height: number;
  seed: number;
  /** Local frame of each named cue. */
  cues: Readonly<Record<string, number>>;
  /** Local frames where each beat in the sequence starts. */
  beats: readonly { id: string; start: number; end: number; captionBox: Rect }[];
  style: { id: string; palette: Readonly<Record<string, string>>; notes: string };
  poses: { start: Readonly<Record<string, Pose>>; end: Readonly<Record<string, Pose>> };
}

/** Beat whose local interval contains `frame` (the last beat holds to the end). */
export function beatAt(props: Pick<SequenceProps, "beats">, frame: number) {
  return props.beats.find((beat) => frame >= beat.start && frame < beat.end) ?? props.beats[props.beats.length - 1];
}

/** Root SVG in design coordinates. Children use 1080x1920 coordinates at every render size. */
export const Canvas: React.FC<{ background?: string; children?: React.ReactNode }> = ({ background, children }) => (
  <svg viewBox={`0 0 ${DESIGN.width} ${DESIGN.height}`} width={DESIGN.width} height={DESIGN.height} style={{ position: "absolute", inset: 0, display: "block" }}>
    {background ? <rect id="background" x={0} y={0} width={DESIGN.width} height={DESIGN.height} fill={background} /> : null}
    {children}
  </svg>
);
