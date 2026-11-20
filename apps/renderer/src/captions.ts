export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface CaptionChunk {
  words: CaptionWord[];
  text: string;
  start: number;
  end: number;
}

export interface ChunkOptions {
  maxChars: number;
  maxWords: number;
  maxSec: number;
  holdSec: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxChars: 44, maxWords: 7, maxSec: 2.8, holdSec: 0.65 };
const ENDS_SENTENCE = /[.!?…]["')\]]?$/;
const ENDS_CLAUSE = /[,;:]["')\]]?$/;
const STARTS_PHRASE = /^(a|an|the|in|of|to|and|with|for|from|at|by|or|its|that|through|into)$/i;

/** Group complete phrases independently of scene cuts, retaining the original word timings. */
export function captionChunks(words: readonly CaptionWord[], opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): CaptionChunk[] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  for (const [index, word] of words.entries()) {
    current.push(word);
    const next = words[index + 1];
    const text = current.map((item) => item.text).join(" ");
    const phraseEnds = ENDS_SENTENCE.test(word.text) || (current.length >= 3 && ENDS_CLAUSE.test(word.text));
    const full = current.length >= opts.maxWords ||
      (next !== undefined && text.length + 1 + next.text.length > opts.maxChars) ||
      (next !== undefined && next.end - current[0]!.start > opts.maxSec);
    const pause = next !== undefined && next.start - word.end > opts.holdSec;
    if (!next || phraseEnds || full || pause) {
      let split = current.length;
      if (next && full && !phraseEnds && !pause) {
        for (let candidate = current.length - 1; candidate >= Math.max(3, current.length - 2); candidate--) {
          if (STARTS_PHRASE.test(current[candidate]!.text)) split = candidate;
        }
      }
      groups.push(current.slice(0, split));
      current = current.slice(split);
    }
  }
  return groups.map((group, index) => {
    const start = group[0]!.start;
    const lastEnd = group[group.length - 1]!.end;
    const nextStart = groups[index + 1]?.[0]?.start;
    const end = nextStart !== undefined && nextStart - lastEnd <= opts.holdSec ? nextStart : lastEnd + opts.holdSec;
    return { words: group, text: group.map((word) => word.text).join(" "), start, end: Math.max(start, end) };
  });
}

export function chunkAt(chunks: readonly CaptionChunk[], time: number): CaptionChunk | undefined {
  return chunks.find((chunk) => time >= chunk.start && time < chunk.end);
}

/** Fixed line membership prevents the active word's scale from reflowing its neighbours. */
export function captionLines(words: readonly CaptionWord[], maxChars = 25): CaptionWord[][] {
  const text = words.map((word) => word.text).join(" ");
  if (text.length <= maxChars || words.length < 2) return [[...words]];
  let split = 1;
  let bestBalance = Infinity;
  for (let index = 1; index < words.length; index++) {
    const left = words.slice(0, index).map((word) => word.text).join(" ").length;
    const right = words.slice(index).map((word) => word.text).join(" ").length;
    const balance = Math.abs(left - right);
    if (balance < bestBalance) {
      bestBalance = balance;
      split = index;
    }
  }
  return [words.slice(0, split), words.slice(split)];
}

export function captionFontSize(text: string, width: number, max: number, min: number): number {
  return Math.round(Math.max(min, Math.min(max, width / (Math.max(text.length, 1) * 0.61))));
}

/** Brief attack and release, evaluated in composition time so highlighting survives scene cuts. */
export function wordEmphasis(word: CaptionWord, time: number, nextStart?: number): number {
  const end = Math.min(nextStart ?? Infinity, Math.max(word.end, word.start + 0.12));
  if (time < word.start || time >= end) return 0;
  const attack = Math.min(1, (time - word.start) / 0.045);
  const release = Math.min(1, (end - time) / 0.06);
  return Math.max(0, Math.min(attack, release));
}
