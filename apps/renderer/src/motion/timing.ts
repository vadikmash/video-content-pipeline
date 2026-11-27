import { Easing, spring as remotionSpring } from "remotion";

/** A timing curve maps progress 0..1 to eased progress (may overshoot for springs). */
export type Ease = (t: number) => number;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const ease = {
  /** Holds the start value until the segment ends, then jumps. */
  hold: (() => 0) as Ease,
  linear: ((t) => clamp01(t)) as Ease,
  in: (power = 3): Ease => (t) => clamp01(t) ** power,
  out: (power = 3): Ease => (t) => 1 - (1 - clamp01(t)) ** power,
  inOut: (power = 3): Ease => (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 2 ** (power - 1) * x ** power : 1 - (-2 * x + 2) ** power / 2;
  },
  bezier: (x1: number, y1: number, x2: number, y2: number): Ease => {
    if (![x1, x2].every((x) => x >= 0 && x <= 1)) throw new Error("Bezier x control points must be within 0..1");
    const curve = Easing.bezier(x1, y1, x2, y2);
    return (t) => curve(clamp01(t));
  },
} as const;

export interface Key<T = number> {
  frame: number;
  value: T;
  /** Curve used from the previous key to this one. Defaults to ease.inOut(). */
  ease?: Ease;
}

const defaultEase = ease.inOut();

function checkKeys(keys: readonly Key<unknown>[]): void {
  if (keys.length === 0) throw new Error("tween needs at least one key");
  for (let i = 1; i < keys.length; i++) {
    if (!(keys[i]!.frame >= keys[i - 1]!.frame)) throw new Error(`Keys must be in frame order (key ${i} at ${keys[i]!.frame})`);
  }
}

/**
 * Evaluate keyframes at `frame`. Values hold before the first and after the
 * last key, so every frame evaluates directly without history.
 */
export function tween(frame: number, keys: readonly Key[]): number {
  checkKeys(keys);
  const first = keys[0]!;
  if (frame <= first.frame) return first.value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (frame < b.frame) {
      const span = b.frame - a.frame;
      const t = span === 0 ? 1 : (frame - a.frame) / span;
      return a.value + (b.value - a.value) * (b.ease ?? defaultEase)(t);
    }
  }
  return keys[keys.length - 1]!.value;
}

/** Damped spring from `from` to `to` starting at `start`; settles with optional overshoot. */
export function settle(frame: number, opts: { start: number; from: number; to: number; fps: number; damping?: number; stiffness?: number; mass?: number }): number {
  if (frame <= opts.start) return opts.from;
  const progress = remotionSpring({
    frame: frame - opts.start,
    fps: opts.fps,
    config: { damping: opts.damping ?? 12, stiffness: opts.stiffness ?? 120, mass: opts.mass ?? 1 },
  });
  return opts.from + (opts.to - opts.from) * progress;
}

/**
 * Keys for a move with anticipation and follow-through: a small wind-up against
 * the direction of travel before `start`, the main action to `end`, an
 * overshoot, then a settle by `settleEnd`.
 */
export function anticipate(opts: {
  from: number;
  to: number;
  start: number;
  end: number;
  anticipationFrames?: number;
  anticipation?: number;
  overshoot?: number;
  settleFrames?: number;
}): Key[] {
  const span = opts.to - opts.from;
  const windup = opts.anticipationFrames ?? 6;
  const settleFrames = opts.settleFrames ?? 10;
  const overshootEnd = opts.end + Math.max(1, Math.round(settleFrames / 2));
  if (!(opts.end > opts.start)) throw new Error("anticipate needs end after start");
  return [
    { frame: opts.start - windup, value: opts.from },
    { frame: opts.start, value: opts.from - span * (opts.anticipation ?? 0.08), ease: ease.out(2) },
    { frame: opts.end, value: opts.to + span * (opts.overshoot ?? 0.06), ease: ease.out(3) },
    { frame: overshootEnd, value: opts.to - span * (opts.overshoot ?? 0.06) * 0.3, ease: ease.inOut(2) },
    { frame: opts.end + settleFrames, value: opts.to, ease: ease.inOut(2) },
  ];
}

/** Local frame of a named cue plus a bounded signed offset. Throws on an unknown cue. */
export function cueFrame(cues: Readonly<Record<string, number>>, name: string, offset = 0): number {
  const frame = cues[name];
  if (frame === undefined) throw new Error(`Unknown cue ${name}`);
  if (Math.abs(offset) > 30) throw new Error(`Cue offset ${offset} exceeds 30 frames`);
  return frame + offset;
}
