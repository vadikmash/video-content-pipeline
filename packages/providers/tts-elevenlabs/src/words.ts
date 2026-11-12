import type { Word } from "@vcp/core";

export interface TimedText {
  text: string;
  start: number;
  end: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function tokensOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Map a provider's timed fragments onto the whitespace tokens of `text`. */
export function wordsFromAlignment(text: string, timed: TimedText[]): Word[] {
  const tokens = tokensOf(text);
  if (!tokens.length) return [];
  const spoken = timed.filter((w) => w.text.trim().length > 0);
  if (spoken.length === tokens.length) {
    return monotonic(
      tokens.map((token, i) => ({
        text: token,
        start: spoken[i]!.start,
        end: Math.max(spoken[i]!.end, spoken[i]!.start),
      })),
    );
  }
  const start = spoken[0]?.start ?? 0;
  const end = spoken[spoken.length - 1]?.end ?? Math.max(start, tokens.length * 0.4);
  return even(tokens, start, end);
}

/** Collapse character-level alignment onto the whitespace tokens of `text`. */
export function wordsFromCharacters(text: string, characters: string[], starts: number[], ends: number[]): Word[] {
  const tokens = tokensOf(text);
  if (!tokens.length) return [];
  if (!characters.length) return even(tokens, 0, tokens.length * 0.4);
  const joined = characters.join("");
  let cursor = 0;
  const out: Word[] = [];
  for (const token of tokens) {
    const idx = joined.indexOf(token, cursor);
    if (idx < 0) {
      const start = starts[0] ?? 0;
      const end = ends[ends.length - 1] ?? start + tokens.length * 0.4;
      return even(tokens, start, end);
    }
    const endIdx = Math.min(ends.length - 1, idx + token.length - 1);
    const start = starts[idx] ?? 0;
    const end = ends[endIdx] ?? start;
    out.push({ text: token, start, end: Math.max(end, start) });
    cursor = idx + token.length;
  }
  return monotonic(out);
}

function even(tokens: string[], start: number, end: number): Word[] {
  const span = Math.max(end - start, tokens.length * 0.01);
  const per = span / tokens.length;
  return monotonic(tokens.map((token, i) => ({ text: token, start: start + i * per, end: start + (i + 1) * per })));
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
