import { describe, expect, it } from "vitest";
import { wordsFromAlignment, wordsFromCharacters } from "./words";

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
