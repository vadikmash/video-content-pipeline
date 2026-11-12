/**
 * Caption pages: short phrases that stay put while they are spoken, instead of
 * a window that re-centres on every word. Pure so it can be unit-tested.
 */

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface CaptionPage {
  words: CaptionWord[];
  /** Seconds the page appears. */
  start: number;
  /** Seconds the page disappears (held across short gaps so pages don't flicker). */
  end: number;
}

export interface PageOptions {
  /** Characters per page, spaces included. Two short lines at caption size. */
  maxChars: number;
  maxWords: number;
  /** A silence at least this long starts a new page. */
  pauseSec: number;
  /** How long a page lingers after its last word when nothing follows soon. */
  holdSec: number;
}

export const DEFAULT_PAGE_OPTIONS: PageOptions = { maxChars: 40, maxWords: 8, pauseSec: 0.35, holdSec: 0.4 };

/** Pages shorter than this get merged into a neighbour when they fit, so the screen changes less often. */
const MIN_PAGE_CHARS = 16;

const ENDS_SENTENCE = /[.!?…]["')\]]?$/;
const ENDS_SOFT = /[,:;—–-]["')\]]?$/;

export function captionPages(words: readonly CaptionWord[], opts: PageOptions = DEFAULT_PAGE_OPTIONS): CaptionPage[] {
  const groups: CaptionWord[][] = [];
  let current: CaptionWord[] = [];
  let chars = 0;

  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
    chars = 0;
  };

  words.forEach((word, i) => {
    const prev = words[i - 1];
    const addChars = (current.length ? 1 : 0) + word.text.length;
    const paused = prev !== undefined && word.start - prev.end >= opts.pauseSec;
    if (current.length && (paused || chars + addChars > opts.maxChars || current.length >= opts.maxWords)) flush();
    current.push(word);
    chars += addChars;
    // Sentence ends always break; commas and colons only once the page is fairly full.
    if (ENDS_SENTENCE.test(word.text) || (ENDS_SOFT.test(word.text) && chars >= opts.maxChars * 0.6)) flush();
  });
  flush();

  // Merge short fragments into a neighbour in the same sentence when the result still fits.
  const fits = (a: CaptionWord[], b: CaptionWord[]) => text(a).length + 1 + text(b).length <= opts.maxChars + 6;
  const joined = (a: CaptionWord[], b: CaptionWord[]) =>
    !ENDS_SENTENCE.test(a[a.length - 1]!.text) && b[0]!.start - a[a.length - 1]!.end < opts.pauseSec;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    if (text(g).length >= MIN_PAGE_CHARS) continue;
    const prev = groups[i - 1];
    const next = groups[i + 1];
    if (prev && joined(prev, g) && fits(prev, g)) {
      prev.push(...g);
      groups.splice(i--, 1);
    } else if (next && joined(g, next) && fits(g, next)) {
      g.push(...next);
      groups.splice(i + 1, 1);
      i--;
    } else if (prev && joined(prev, g)) {
      // Too long to merge: rebalance by moving words from the end of the previous page.
      while (prev.length > 1 && text(g).length < MIN_PAGE_CHARS && text(prev.slice(0, -1)).length >= MIN_PAGE_CHARS) {
        g.unshift(prev.pop()!);
      }
    }
  }

  return groups.map((g, i) => {
    const start = g[0]!.start;
    const lastEnd = g[g.length - 1]!.end;
    const nextStart = groups[i + 1]?.[0]?.start;
    // Hold until the next page if it follows closely, else linger briefly.
    const end = nextStart !== undefined && nextStart - lastEnd < opts.holdSec * 2 ? nextStart : lastEnd + opts.holdSec;
    return { words: g, start, end: Math.max(end, start) };
  });
}

export function pageAt(pages: readonly CaptionPage[], t: number): CaptionPage | undefined {
  return pages.find((p) => t >= p.start && t < p.end);
}

function text(words: CaptionWord[]): string {
  return words.map((w) => w.text).join(" ");
}
