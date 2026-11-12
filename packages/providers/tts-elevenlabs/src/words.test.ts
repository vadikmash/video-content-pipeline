import { describe, expect, it } from "vitest";
import { timingsFor } from "./index";
import { matchCharacters, wordsFromAlignment, wordsFromCharacters } from "./words";

describe("wordsFromCharacters", () => {
  it("collapses character timings onto the input tokens", () => {
    const text = "one two three four";
    const characters = text.split("");
    const starts = characters.map((_, i) => i * 0.1);
    const ends = starts.map((s) => s + 0.1);
    const words = wordsFromCharacters(text, characters, starts, ends);
    expect(words.map((w) => w.text)).toEqual(["one", "two", "three", "four"]);
    for (let i = 0; i < words.length; i++) {
      expect(words[i]!.end).toBeGreaterThanOrEqual(words[i]!.start);
      if (i) expect(words[i]!.start).toBeGreaterThanOrEqual(words[i - 1]!.start);
    }
    expect(words[0]!.start).toBe(0);
    expect(words[0]!.end).toBeCloseTo(0.3);
  });

  it("falls back to an even spread when the alignment text does not match", () => {
    const words = wordsFromCharacters("alpha beta", ["nope"], [0], [2]);
    expect(words.map((w) => w.text)).toEqual(["alpha", "beta"]);
    expect(words[1]!.start).toBeGreaterThanOrEqual(words[0]!.start);
  });
});

describe("wordsFromAlignment", () => {
  it("uses provider words when the token count matches", () => {
    const words = wordsFromAlignment("alpha beta gamma", [
      { text: "alpha", start: 0.1, end: 0.4 },
      { text: " ", start: 0.4, end: 0.45 },
      { text: "beta", start: 0.45, end: 0.8 },
      { text: "gamma", start: 0.8, end: 1.2 },
    ]);
    expect(words).toEqual([
      { text: "alpha", start: 0.1, end: 0.4 },
      { text: "beta", start: 0.45, end: 0.8 },
      { text: "gamma", start: 0.8, end: 1.2 },
    ]);
  });
});

/** Character stream for `spoken`, one char per 0.05s, with a 0.5s pause after each sentence end. */
function stream(spoken: string) {
  const characters = [...spoken];
  const starts: number[] = [];
  const ends: number[] = [];
  let t = 0;
  for (const c of characters) {
    starts.push(t);
    t += 0.05;
    ends.push(t);
    if (c === "." || c === "?") t += 0.5;
  }
  return { characters, starts, ends };
}

describe("matchCharacters on real-world text", () => {
  const text = "Nvidia’s CEO resigned on November 12, 2026, to everyone’s surprise. Why?";

  it("matches every word when the stream is the text as sent", () => {
    const s = stream(text);
    const m = matchCharacters(text, s.characters, s.starts, s.ends);
    expect(m.matchedRatio).toBe(1);
    const why = m.words.at(-1)!;
    // "Why?" starts after the 0.5s sentence pause, not at an evenly spread position.
    expect(why.start).toBeCloseTo((text.length - 4) * 0.05 + 0.5, 2);
  });

  it("keeps real timings for the other words when numbers were spelled out", () => {
    const spoken = "Nvidia's CEO resigned on November twelve, twenty twenty-six, to everyone's surprise. Why?";
    const s = stream(spoken);
    const m = matchCharacters(text, s.characters, s.starts, s.ends);
    expect(m.matchedRatio).toBeCloseTo(9 / 11, 2);
    const surprise = m.words.find((w) => w.text === "surprise.")!;
    expect(surprise.start).toBeCloseTo(spoken.indexOf("surprise.") * 0.05, 2);
    // The unmatched "12," and "2026," sit between "November" and "to", in order.
    const at = (t: string) => m.words.find((w) => w.text === t)!;
    const [nov, twelve, year, to] = [at("November"), at("12,"), at("2026,"), at("to")];
    expect(twelve.start).toBeGreaterThanOrEqual(nov.end);
    expect(year.start).toBeGreaterThanOrEqual(twelve.start);
    expect(to.start).toBeGreaterThanOrEqual(year.end);
  });
});

describe("timingsFor", () => {
  const text = "Revenue hit 12 billion in 2026.";
  const asSent = stream(text);
  const normalized = stream("Revenue hit twelve billion in twenty twenty-six.");
  const a = (s: ReturnType<typeof stream>) => ({
    characters: s.characters,
    character_start_times_seconds: s.starts,
    character_end_times_seconds: s.ends,
  });

  it("prefers the alignment of the text as sent", () => {
    const words = timingsFor(text, a(asSent), a(normalized))!;
    expect(words.find((w) => w.text === "2026.")!.start).toBeCloseTo(text.indexOf("2026.") * 0.05, 2);
  });

  it("returns nothing when too few words match, so the Aligner takes over", () => {
    expect(timingsFor(text, a(normalized))).toBeUndefined();
  });
});

describe("wordsFromAlignment with differently split words", () => {
  it("matches by characters rather than by word count", () => {
    const words = wordsFromAlignment("It's 2026 now", [
      { text: "It", start: 0, end: 0.2 },
      { text: "'s", start: 0.2, end: 0.3 },
      { text: "2026", start: 0.5, end: 1.4 },
      { text: "now", start: 1.6, end: 1.9 },
    ]);
    expect(words.map((w) => [w.text, w.start])).toEqual([
      ["It's", 0],
      ["2026", 0.5],
      ["now", 1.6],
    ]);
  });
});
