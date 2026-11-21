import { describe, expect, it } from "vitest";
import { captionChunks, captionLines, chunkAt, type CaptionWord } from "./captions";

function speak(sentence: string, start = 0, per = 0.3): CaptionWord[] {
  return sentence.split(" ").map((text, i) => ({ text, start: start + i * per, end: start + (i + 1) * per }));
}

describe("phrase captions", () => {
  it("limits each caption to three words and keeps its text stable during playback", () => {
    const words = speak("Earth blocks direct sunlight.");
    const chunks = captionChunks(words);
    expect(chunks.map((chunk) => chunk.text)).toEqual(["Earth blocks direct", "sunlight."]);
    expect(chunkAt(chunks, 0.1)).toBe(chunkAt(chunks, 0.6));
  });

  it("retains every word and its timing when a long sentence spans multiple phrases", () => {
    const words = speak("At the edges of Earth the air scatters blue light while red light bends through the atmosphere.");
    const chunks = captionChunks(words);
    expect(chunks.flatMap((chunk) => chunk.words)).toEqual(words);
    for (const chunk of chunks) {
      expect(chunk.words.length).toBeLessThanOrEqual(3);
      expect(chunk.text.length).toBeLessThanOrEqual(24);
    }
    for (let i = 1; i < chunks.length; i++) expect(chunks[i - 1]!.end).toBe(chunks[i]!.start);
  });

  it("preserves sentence boundaries and briefly holds captions across a pause", () => {
    const words = [...speak("The Moon glows red."), ...speak("Here is why.", 2)];
    const chunks = captionChunks(words);
    expect(chunks.map((chunk) => chunk.text)).toEqual(["The Moon glows", "red.", "Here is why."]);
    expect(chunkAt(chunks, 1.5)?.text).toBe("red.");
    expect(chunkAt(chunks, 1.9)).toBeUndefined();
    expect(chunkAt(chunks, 2.1)?.text).toBe("Here is why.");
  });

  it("balances two fixed lines without changing word objects", () => {
    const words = speak("Red light bends through the atmosphere");
    const lines = captionLines(words);
    expect(lines).toHaveLength(2);
    expect(lines.flat()).toEqual(words);
    expect(Math.abs(lines[0]!.map((w) => w.text).join(" ").length - lines[1]!.map((w) => w.text).join(" ").length)).toBeLessThan(10);
  });

  it("handles empty narration", () => {
    expect(captionChunks([])).toEqual([]);
    expect(chunkAt([], 1)).toBeUndefined();
  });
});
