import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cutsFor, parseSilences, remapTime, remapWords, tightenPauses } from "../src/audio/pauses";

describe("pause maths", () => {
  it("parses ffmpeg silencedetect output", () => {
    const stderr = [
      "[silencedetect @ 0x1] silence_start: 1.25",
      "[silencedetect @ 0x1] silence_end: 2.05 | silence_duration: 0.8",
      "[silencedetect @ 0x1] silence_start: 4",
      "[silencedetect @ 0x1] silence_end: 4.2 | silence_duration: 0.2",
    ].join("\n");
    expect(parseSilences(stderr)).toEqual([
      { start: 1.25, end: 2.05 },
      { start: 4, end: 4.2 },
    ]);
  });

  it("cuts only silences longer than the limit, keeping the limit centred", () => {
    const cuts = cutsFor(
      [
        { start: 1, end: 2 },
        { start: 3, end: 3.2 },
      ],
      0.25,
    );
    expect(cuts).toEqual([{ start: 1.125, end: 1.875 }]);
  });

  it("shifts later times back by what was removed and pins times inside a cut", () => {
    const cuts = [{ start: 1.125, end: 1.875 }];
    expect(remapTime(1, cuts)).toBe(1);
    expect(remapTime(1.5, cuts)).toBe(1.125);
    expect(remapTime(3, cuts)).toBe(2.25);
  });

  it("keeps word timings monotonic", () => {
    const words = [
      { text: "a", start: 0, end: 1.2 },
      { text: "b", start: 1.2, end: 2.5 },
      { text: "c", start: 2.5, end: 3 },
    ];
    const out = remapWords(words, [{ start: 1.125, end: 1.875 }]);
    for (let i = 1; i < out.length; i++) expect(out[i]!.start).toBeGreaterThanOrEqual(out[i - 1]!.start);
    expect(out.at(-1)!.end).toBe(2.25);
  });
});

describe("tightenPauses with ffmpeg", () => {
  it("shortens a 1s pause to 0.25s and shifts words after it", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vcp-pauses-"));
    try {
      const file = path.join(dir, "in.mp3");
      // tone 1s, silence 1s, tone 1s
      execFileSync("ffmpeg", [
        "-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=1", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=1",
        "-f", "lavfi", "-i", "sine=f=440:d=1", "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", "-c:a", "libmp3lame", file,
      ]);
      const words = [
        { text: "one", start: 0, end: 1 },
        { text: "two", start: 2, end: 3 },
      ];
      const out = await tightenPauses(new Uint8Array(readFileSync(file)), words);
      expect(out.pauses).toBe(1);
      expect(out.removedSec).toBeGreaterThan(0.6);
      expect(out.removedSec).toBeLessThan(0.85);
      expect(out.words[1]!.start).toBeCloseTo(2 - out.removedSec, 2);
      const outFile = path.join(dir, "out.mp3");
      writeFileSync(outFile, out.audio);
      const duration = (f: string) =>
        Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
      // Within a frame or two: MP3 encoding adds a few ms of padding on each pass.
      expect(Math.abs(duration(file) - out.removedSec - duration(outFile))).toBeLessThan(0.06);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
