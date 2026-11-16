/**
 * Music bed envelope: full bed level in pauses, ducked under narration,
 * with short ramps so the bed never jumps. Pure so it can be unit-tested.
 */

export interface TimedWord {
  start: number;
  end: number;
}

export const BED_LEVEL = 0.18;
export const DUCK_LEVEL = 0.04;
/** Seconds the bed takes to move between levels. */
export const RAMP = 0.25;
/** Gaps between words shorter than this stay ducked (no pumping between words). */
export const MERGE_GAP = 0.6;
const FADE_IN = 0.5;
const FADE_OUT = 2.5;

export type Span = [start: number, end: number];

/** Merge word timings into continuous speech spans. */
export function speechSpans(words: readonly TimedWord[], mergeGap = MERGE_GAP): Span[] {
  const sorted = [...words].filter((w) => w.end >= w.start).sort((a, b) => a.start - b.start);
  const spans: Span[] = [];
  for (const w of sorted) {
    const last = spans[spans.length - 1];
    if (last && w.start - last[1] <= mergeGap) last[1] = Math.max(last[1], w.end);
    else spans.push([w.start, w.end]);
  }
  return spans;
}

/** Seconds from t to the nearest speech span (0 inside one). */
function distanceToSpeech(t: number, spans: readonly Span[]): number {
  let best = Infinity;
  for (const [s, e] of spans) {
    if (t >= s && t <= e) return 0;
    best = Math.min(best, t < s ? s - t : t - e);
  }
  return best;
}

/** Bed volume at time t (seconds). */
export function musicVolume(t: number, spans: readonly Span[], durationSec: number): number {
  // The ramp starts RAMP seconds before speech so the duck has landed when the first word hits.
  const open = Math.min(1, distanceToSpeech(t, spans) / RAMP);
  const level = DUCK_LEVEL + (BED_LEVEL - DUCK_LEVEL) * open;
  const fadeIn = clamp01(t / FADE_IN);
  const fadeOut = clamp01((durationSec - t) / FADE_OUT);
  return level * fadeIn * fadeOut;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
