/**
 * Big centred captions: one word at a time, as it is said. A word spoken too
 * quickly to register on its own rides along with the next one.
 * Pure so it can be unit-tested.
 */

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface CaptionChunk {
  words: CaptionWord[];
  text: string;
  /** Seconds the chunk appears (its first word starts). */
  start: number;
  /** Seconds it disappears: when the next chunk appears, or shortly after its last word. */
  end: number;
}

export interface ChunkOptions {
  /** A chunk never grows past this many characters (one line at caption size). */
  maxChars: number;
  /** Words this short join the next word. 0 keeps every word on its own, like the reference Shorts. */
  shortWordChars: number;
  /** A chunk shown for less than this joins the next one (avoids one-frame flashes). */
  minSec: number;
  /** How long the last chunk before a pause stays up after its word ends. */
  holdSec: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxChars: 14, shortWordChars: 0, minSec: 0.15, holdSec: 0.3 };

const ENDS_SENTENCE = /[.!?…]["')\]]?$/;

export function captionChunks(words: readonly CaptionWord[], opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): CaptionChunk[] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];

  words.forEach((word, i) => {
    current.push(word);
    const next = words[i + 1];
    const text = joinText(current);
    const canGrow =
      next !== undefined &&
      !ENDS_SENTENCE.test(word.text) &&
      text.length + 1 + next.text.length <= opts.maxChars &&
      ((opts.shortWordChars > 0 && bare(word.text).length <= opts.shortWordChars) || next.start - current[0]!.start < opts.minSec);
    if (!canGrow) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length) groups.push(current);

  return groups.map((g, i) => {
    const start = g[0]!.start;
    const lastEnd = g[g.length - 1]!.end;
    const nextStart = groups[i + 1]?.[0]?.start;
    // Stay up until the next chunk when it follows closely; otherwise linger briefly.
    const end = nextStart !== undefined && nextStart - lastEnd <= opts.holdSec ? nextStart : lastEnd + opts.holdSec;
    return { words: g, text: joinText(g), start, end: Math.max(end, start) };
  });
}

export function chunkAt(chunks: readonly CaptionChunk[], t: number): CaptionChunk | undefined {
  return chunks.find((c) => t >= c.start && t < c.end);
}

/**
 * Font size that keeps a chunk on one line inside `width` pixels. Impact-style
 * faces are narrow, about 0.5em per character on average.
 */
export function captionFontSize(text: string, width: number, max: number, min: number): number {
  const fit = width / (Math.max(text.length, 1) * 0.5);
  return Math.round(Math.max(min, Math.min(max, fit)));
}

function joinText(words: readonly CaptionWord[]): string {
  return words.map((w) => w.text).join(" ");
}

function bare(text: string): string {
  return text.replace(/[^\p{L}\p{N}]/gu, "");
}
