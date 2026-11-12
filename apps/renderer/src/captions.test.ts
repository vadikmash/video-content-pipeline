import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_OPTIONS, captionPages, pageAt, type CaptionWord } from "./captions";

/** Words back to back at 0.3s each, like ElevenLabs timings. */
function speak(sentence: string, start = 0, per = 0.3): CaptionWord[] {
  return sentence.split(" ").map((text, i) => ({ text, start: start + i * per, end: start + (i + 1) * per }));
}
const texts = (words: CaptionWord[]) => words.map((w) => w.text).join(" ");

describe("captionPages", () => {
  it("breaks at sentence ends", () => {
    const pages = captionPages(speak("The emus won. The army left."));
    expect(pages.map((p) => texts(p.words))).toEqual(["The emus won.", "The army left."]);
  });

  it("keeps every page within the character and word limits", () => {
    const words = speak(
      "Octopuses have not one but three hearts and one main heart called the systemic heart pumps blood around the whole body while two gill hearts help",
    );
    const pages = captionPages(words);
    for (const p of pages) {
      expect(texts(p.words).length).toBeLessThanOrEqual(DEFAULT_PAGE_OPTIONS.maxChars + 6);
      expect(p.words.length).toBeLessThanOrEqual(DEFAULT_PAGE_OPTIONS.maxWords + 1);
    }
    expect(pages.flatMap((p) => p.words)).toEqual(words);
  });

  it("starts a new page after a pause", () => {
    const words = [...speak("Did you know", 0), ...speak("octopuses have three hearts", 2)];
    expect(captionPages(words).map((p) => texts(p.words))).toEqual(["Did you know", "octopuses have three hearts"]);
  });

  it("holds a page until the next one so captions don't flicker between phrases", () => {
    const pages = captionPages(speak("First phrase here. Second phrase follows."));
    expect(pages[0]!.end).toBe(pages[1]!.start);
  });

  it("lingers briefly after the last page", () => {
    const words = speak("Only one.");
    const [page] = captionPages(words);
    expect(page!.end).toBeCloseTo(words[1]!.end + DEFAULT_PAGE_OPTIONS.holdSec);
  });

  it("does not leave a lone word on its own page", () => {
    const pages = captionPages(speak("one two three four five six seven eight"), { ...DEFAULT_PAGE_OPTIONS, maxWords: 7 });
    expect(pages.every((p) => p.words.length > 1)).toBe(true);
  });

  it("changes pages far less often than words", () => {
    const words = speak(
      "Here is the wild part. When an octopus swims, its main heart stops, so the animal gets tired very quickly.",
    );
    const pages = captionPages(words);
    expect(pages.length).toBeLessThanOrEqual(Math.ceil(words.length / 3));
    // Every moment of speech is covered by exactly one page.
    for (const w of words) expect(pageAt(pages, w.start + 0.01)?.words).toContain(w);
  });

  it("rebalances a short tail that is too long to merge into the previous page", () => {
    const pages = captionPages(speak("thanks to a copper-based molecule called hemocyanin instead of our iron-based hemoglobin."));
    expect(pages.every((p) => texts(p.words).length >= 16)).toBe(true);
    expect(pages.at(-1)!.words.length).toBeGreaterThan(1);
  });

  it("handles no words", () => {
    expect(captionPages([])).toEqual([]);
  });
});
