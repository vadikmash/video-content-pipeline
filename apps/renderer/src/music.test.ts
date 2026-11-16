import { describe, expect, it } from "vitest";
import { BED_LEVEL, DUCK_LEVEL, musicVolume, speechSpans } from "./music";

const words = [
  { start: 1.0, end: 1.3 },
  { start: 1.4, end: 1.8 }, // short gap: same span
  { start: 4.0, end: 4.5 }, // long pause before this: new span
];

describe("speechSpans", () => {
  it("merges words separated by short gaps and splits on pauses", () => {
    expect(speechSpans(words)).toEqual([
      [1.0, 1.8],
      [4.0, 4.5],
    ]);
  });
  it("handles no narration", () => {
    expect(speechSpans([])).toEqual([]);
  });
});

describe("musicVolume", () => {
  const spans = speechSpans(words);
  const dur = 20;
  it("ducks under speech", () => {
    expect(musicVolume(1.5, spans, dur)).toBeCloseTo(DUCK_LEVEL);
    expect(musicVolume(4.2, spans, dur)).toBeCloseTo(DUCK_LEVEL);
  });
  it("comes back up to bed level in a pause", () => {
    expect(musicVolume(3.0, spans, dur)).toBeCloseTo(BED_LEVEL);
  });
  it("ramps rather than jumps", () => {
    const mid = musicVolume(1.8 + 0.125, spans, dur);
    expect(mid).toBeGreaterThan(DUCK_LEVEL);
    expect(mid).toBeLessThan(BED_LEVEL);
  });
  it("fades in at the start and out at the end", () => {
    expect(musicVolume(0, spans, dur)).toBe(0);
    expect(musicVolume(dur, spans, dur)).toBe(0);
    expect(musicVolume(dur - 1, spans, dur)).toBeLessThan(BED_LEVEL);
  });
  it("plays at bed level with no narration", () => {
    expect(musicVolume(10, [], dur)).toBeCloseTo(BED_LEVEL);
  });
});
