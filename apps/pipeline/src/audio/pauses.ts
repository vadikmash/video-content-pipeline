/**
 * Shorten long pauses in narration. Silences longer than `maxPauseSec` are cut
 * down to that length (the middle is removed, so the natural fade around each
 * word stays), and word timings are shifted to match the new audio.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Word } from "@vcp/core";

export interface Span {
  start: number;
  end: number;
}

export interface TightenOptions {
  /** Longest pause kept, in seconds. */
  maxPauseSec: number;
  /** Level below which audio counts as silence. */
  noiseDb: number;
}

export const DEFAULT_TIGHTEN: TightenOptions = { maxPauseSec: 0.25, noiseDb: -38 };

/** Parse `silencedetect` output from ffmpeg's stderr. */
export function parseSilences(stderr: string): Span[] {
  const out: Span[] = [];
  let start: number | undefined;
  for (const line of stderr.split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start !== undefined) {
      out.push({ start, end: Number(e[1]) });
      start = undefined;
    }
  }
  return out;
}

/** Regions to remove so that no silence lasts longer than maxPauseSec. */
export function cutsFor(silences: readonly Span[], maxPauseSec: number): Span[] {
  return silences
    .filter((s) => s.end - s.start > maxPauseSec)
    .map((s) => ({ start: s.start + maxPauseSec / 2, end: s.end - maxPauseSec / 2 }));
}

/** Where time t of the original audio lands after the cuts. */
export function remapTime(t: number, cuts: readonly Span[]): number {
  let removed = 0;
  for (const c of cuts) {
    if (t >= c.end) removed += c.end - c.start;
    else if (t > c.start) removed += t - c.start;
  }
  return round(t - removed);
}

export function remapWords(words: readonly Word[], cuts: readonly Span[]): Word[] {
  return words.map((w) => ({ text: w.text, start: remapTime(w.start, cuts), end: remapTime(w.end, cuts) }));
}

export function removedSeconds(cuts: readonly Span[]): number {
  return round(cuts.reduce((sum, c) => sum + (c.end - c.start), 0));
}

/**
 * ffmpeg filter graph (for -filter_complex, output label [out]) that keeps the
 * audio between cuts and joins it. atrim is sample-accurate, and unlike aselect
 * it behaves the same across ffmpeg releases (8.0's aselect drops nothing).
 */
export function cutFilter(cuts: readonly Span[]): string {
  const keep: string[] = [];
  let from = 0;
  for (const c of cuts) {
    keep.push(`atrim=start=${from.toFixed(3)}:end=${c.start.toFixed(3)}`);
    from = c.end;
  }
  keep.push(`atrim=start=${from.toFixed(3)}`);
  const labels = keep.map((_, i) => `[k${i}]`);
  const split = `[0:a]asplit=${keep.length}${keep.map((_, i) => `[s${i}]`).join("")}`;
  const parts = keep.map((trim, i) => `[s${i}]${trim},asetpts=PTS-STARTPTS${labels[i]}`);
  return [split, ...parts, `${labels.join("")}concat=n=${keep.length}:v=0:a=1[out]`].join(";");
}

/**
 * Run ffmpeg: detect silences, cut the long ones, re-encode as MP3.
 * Returns the original audio unchanged when nothing needs cutting.
 */
export async function tightenPauses(
  audio: Uint8Array,
  words: readonly Word[],
  opts: TightenOptions = DEFAULT_TIGHTEN,
): Promise<{ audio: Uint8Array; contentType?: string; words: Word[]; removedSec: number; pauses: number }> {
  // Files, not pipes: an MP3 written to a pipe has no header to trim encoder padding,
  // which would shift the voice ~25ms behind the word timings.
  const dir = await mkdtemp(path.join(os.tmpdir(), "vcp-voice-"));
  try {
    const input = path.join(dir, "in.mp3");
    const output = path.join(dir, "out.mp3");
    await writeFile(input, audio);
    const detect = await ffmpeg(["-hide_banner", "-i", input, "-af", `silencedetect=noise=${opts.noiseDb}dB:d=0.1`, "-f", "null", "-"]);
    const cuts = cutsFor(parseSilences(detect), opts.maxPauseSec);
    if (!cuts.length) return { audio, words: [...words], removedSec: 0, pauses: 0 };
    await ffmpeg(["-hide_banner", "-y", "-i", input, "-filter_complex", cutFilter(cuts), "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "128k", output]);
    return {
      audio: new Uint8Array(await readFile(output)),
      contentType: "audio/mpeg",
      words: remapWords(words, cuts),
      removedSec: removedSeconds(cuts),
      pauses: cuts.length,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Run ffmpeg and return its stderr (where silencedetect reports). */
function ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
      else resolve(stderr);
    });
  });
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
