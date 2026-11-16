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

/** ffmpeg audio filter that drops the cut regions and closes the gaps. */
export function cutFilter(cuts: readonly Span[]): string {
  const between = cuts.map((c) => `between(t,${c.start.toFixed(3)},${c.end.toFixed(3)})`).join("+");
  // Small sample blocks so cuts land within ~1.5ms instead of a whole MP3 frame (~26ms).
  return `asetnsamples=n=64,aselect='not(${between})',asetpts=N/SR/TB`;
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
    await ffmpeg(["-hide_banner", "-y", "-i", input, "-af", cutFilter(cuts), "-c:a", "libmp3lame", "-b:a", "128k", output]);
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
