import { describe, expect, it } from "vitest";
import { DEFAULT_CHUNK_OPTIONS, captionChunks, captionFontSize, chunkAt, type CaptionWord } from "./captions";

/** Words back to back, like ElevenLabs timings. */
function speak(sentence: string, start = 0, per = 0.3): CaptionWord[] {
  return sentence.split(" ").map((text, i) => ({ text, start: start + i * per, end: start + (i + 1) * per }));
}

describe("captionChunks", () => {
  it("shows one word at a time", () => {
    const chunks = captionChunks(speak("Honey stays edible forever"));
    expect(chunks.map((c) => c.text)).toEqual(["Honey", "stays", "edible", "forever"]);
  });

  it("keeps short words on their own by default, like the reference", () => {
    const chunks = captionChunks(speak("It is a food that lasts"));
    expect(chunks.map((c) => c.text)).toEqual(["It", "is", "a", "food", "that", "lasts"]);
  });

  it("can let short words ride with the next real word", () => {
    const chunks = captionChunks(speak("It is a food that lasts"), { ...DEFAULT_CHUNK_OPTIONS, shortWordChars: 3 });
    expect(chunks.map((c) => c.text)).toEqual(["It is a food", "that", "lasts"]);
  });

  it("never runs past one line", () => {
    const words = "a an the of to in on at by it is so we".split(" ").map((text, i) => ({ text, start: i * 0.05, end: (i + 1) * 0.05 }));
    const chunks = captionChunks(words);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(DEFAULT_CHUNK_OPTIONS.maxChars);
  });

  it("does not join across a sentence end", () => {
    const words = [
      { text: "works.", start: 0, end: 0.05 },
      { text: "So", start: 0.05, end: 0.3 },
    ];
    // "works." is too quick to show alone, but a sentence end still never joins the next word.
    expect(captionChunks(words).map((c) => c.text)).toEqual(["works.", "So"]);
  });

  it("joins a word said too quickly to read on its own", () => {
    const words = [
      { text: "really", start: 0, end: 0.08 },
      { text: "quick", start: 0.08, end: 0.4 },
      { text: "words", start: 0.4, end: 0.8 },
    ];
    expect(captionChunks(words).map((c) => c.text)).toEqual(["really quick", "words"]);
  });

  it("holds each chunk until the next appears, and lingers briefly before a pause", () => {
    const words = [...speak("alpha beta", 0), ...speak("gamma", 2)];
    const chunks = captionChunks(words);
    expect(chunks.map((c) => c.text)).toEqual(["alpha", "beta", "gamma"]);
    expect(chunks[0]!.end).toBe(chunks[1]!.start);
    expect(chunks[1]!.end).toBeCloseTo(0.6 + DEFAULT_CHUNK_OPTIONS.holdSec);
    expect(chunkAt(chunks, 1.5)).toBeUndefined();
    expect(chunkAt(chunks, 2.1)?.text).toBe("gamma");
  });

  it("covers every spoken word exactly once, in order", () => {
    const words = speak("Here is the wild part: when an octopus swims, its main heart stops.");
    const chunks = captionChunks(words);
    expect(chunks.flatMap((c) => c.words)).toEqual(words);
  });

  it("handles no words", () => {
    expect(captionChunks([])).toEqual([]);
  });
});

describe("captionFontSize", () => {
  it("uses the max size for short words and shrinks long ones to fit", () => {
    expect(captionFontSize("heart", 920, 150, 80)).toBe(150);
    const long = captionFontSize("microorganisms", 920, 150, 80);
    expect(long).toBeLessThan(150);
    expect(long * 0.5 * "microorganisms".length).toBeLessThanOrEqual(920);
  });
});
