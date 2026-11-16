import type { Word } from "@vcp/core";

export interface TimedText {
  text: string;
  start: number;
  end: number;
}

export interface WordMatch {
  words: Word[];
  /** Share of tokens whose timing came from the provider; the rest were interpolated. */
  matchedRatio: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** How far ahead (in characters) a token may be found; further means we lost our place. */
const MAX_SKIP = 48;
/** Duration given to an unmatched word with no matched neighbour on one side. */
const FALLBACK_WORD_SEC = 0.3;

export function tokensOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Compare text loosely: case and punctuation don't matter (aligners may drop it). */
function fold(s: string): string {
  return s.toLowerCase().replace(/[\p{P}\p{S}]/gu, "");
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Map per-character timings onto the whitespace tokens of `text`. Each token is
 * found in order in the character stream; a token that can't be found (the
 * provider spelled out a number, say) is interpolated between its matched
 * neighbours instead of discarding every other timing.
 */
export function matchCharacters(
  text: string,
  characters: string[],
  starts: number[],
  ends: number[],
  /** Source characters that begin a word even with no separator before them (aligner words). */
  wordStarts?: ReadonlySet<number>,
): WordMatch {
  const tokens = tokensOf(text);
  if (!tokens.length) return { words: [], matchedRatio: 1 };

  // Folded stream plus, for each position in it, the index of the source character.
  let joined = "";
  const source: number[] = [];
  characters.forEach((c, i) => {
    const f = fold(c);
    joined += f;
    for (let k = 0; k < f.length; k++) source.push(i);
  });

  // A token may only match where a word begins, so "we" can't lock onto "t-we-nty".
  const atWordStart = (idx: number) =>
    idx === 0 || !WORD_CHAR.test(joined[idx - 1]!) || (wordStarts?.has(source[idx]!) && source[idx - 1] !== source[idx]);
  const find = (t: string, from: number) => {
    for (let idx = joined.indexOf(t, from); idx >= 0 && idx - from <= MAX_SKIP; idx = joined.indexOf(t, idx + 1)) {
      if (atWordStart(idx)) return idx;
    }
    return -1;
  };

  let cursor = 0;
  const timed: (Word | undefined)[] = tokens.map((token) => {
    const t = fold(token);
    if (!t) return undefined;
    const idx = find(t, cursor);
    if (idx < 0) return undefined;
    cursor = idx + t.length;
    const first = source[idx]!;
    const last = source[idx + t.length - 1]!;
    const start = starts[first] ?? 0;
    return { text: token, start, end: Math.max(ends[last] ?? start, start) };
  });

  const matched = timed.filter(Boolean).length;
  const streamEnd = ends[ends.length - 1] ?? 0;
  return { words: monotonic(fillGaps(tokens, timed, streamEnd)), matchedRatio: matched / tokens.length };
}

/** Back-compat wrapper: words only. */
export function wordsFromCharacters(text: string, characters: string[], starts: number[], ends: number[]): Word[] {
  return matchCharacters(text, characters, starts, ends).words;
}

/**
 * Map word-level timings (e.g. forced alignment output) onto the tokens of `text`.
 * The provider may split or normalise words differently, so match on characters
 * rather than assuming the word counts line up. Matching is sequential and needs no
 * separators, so pieces like "It" + "'s" still match "It's".
 */
export function wordsFromAlignment(text: string, timed: TimedText[]): Word[] {
  const characters: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const wordStarts = new Set<number>();
  for (const w of timed) {
    const chars = [...w.text];
    if (!chars.length) continue;
    wordStarts.add(characters.length);
    const span = Math.max(w.end - w.start, 0);
    chars.forEach((c, k) => {
      characters.push(c);
      starts.push(w.start + (span * k) / chars.length);
      ends.push(w.start + (span * (k + 1)) / chars.length);
    });
  }
  return matchCharacters(text, characters, starts, ends, wordStarts).words;
}

/** Spread each run of unmatched tokens evenly between the matched words around it. */
function fillGaps(tokens: string[], timed: (Word | undefined)[], streamEnd: number): Word[] {
  const out: Word[] = [];
  let i = 0;
  while (i < tokens.length) {
    const known = timed[i];
    if (known) {
      out.push(known);
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && !timed[j]) j++;
    const count = j - i;
    const prevEnd = out.length ? out[out.length - 1]!.end : undefined;
    const nextStart = timed[j]?.start;
    let from: number;
    let to: number;
    if (prevEnd !== undefined && nextStart !== undefined) [from, to] = [prevEnd, Math.max(nextStart, prevEnd)];
    else if (nextStart !== undefined) [from, to] = [Math.max(0, nextStart - count * FALLBACK_WORD_SEC), nextStart];
    else if (prevEnd !== undefined) [from, to] = [prevEnd, Math.max(streamEnd, prevEnd + count * FALLBACK_WORD_SEC)];
    else [from, to] = [0, Math.max(streamEnd, count * FALLBACK_WORD_SEC)];
    const per = (to - from) / count;
    for (let k = 0; k < count; k++) {
      out.push({ text: tokens[i + k]!, start: from + k * per, end: from + (k + 1) * per });
    }
    i = j;
  }
  return out;
}

function monotonic(words: Word[]): Word[] {
  let prev = 0;
  return words.map((word) => {
    const start = Math.max(round(word.start), prev);
    const end = Math.max(round(word.end), start);
    prev = start;
    return { text: word.text, start, end };
  });
}
