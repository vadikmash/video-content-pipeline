import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export const NARRATION_MASTER_VERSION = 1;
export const NARRATION_TARGET_LUFS = -14;
const TRUE_PEAK_DB = -1.5;
// A gentle low shelf adds body. Compression evens peaks before loudness normalization.
const TONE = "highpass=f=65,bass=g=2.5:f=130:w=0.7,acompressor=threshold=0.2:ratio=2:attack=15:release=150:makeup=1";

export async function masterNarration(audio: Uint8Array): Promise<{ audio: Uint8Array; contentType: "audio/wav" }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vcp-master-"));
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    const input = path.join(dir, "input.audio");
    const output = path.join(dir, "master.wav");
    await writeFile(input, audio);
    const norm = `loudnorm=I=${NARRATION_TARGET_LUFS}:TP=${TRUE_PEAK_DB}:LRA=7`;
    const { stderr } = await run(ffmpeg, [
      "-hide_banner", "-i", input, "-af", `${TONE},${norm}:print_format=json`, "-f", "null", "-",
    ], { timeout: 60_000, maxBuffer: 2_000_000 });
    const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
    if (!json) throw new Error("Narration loudness analysis returned no measurement");
    const values = JSON.parse(json) as Record<string, string>;
    const required = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"] as const;
    if (required.some((key) => !Number.isFinite(Number(values[key])))) {
      throw new Error("Narration has no measurable speech level");
    }
    const measured = `:measured_I=${values.input_i}:measured_TP=${values.input_tp}` +
      `:measured_LRA=${values.input_lra}:measured_thresh=${values.input_thresh}:offset=${values.target_offset}:linear=true`;
    await run(ffmpeg, [
      "-v", "error", "-y", "-i", input, "-af", `${TONE},${norm}${measured}`,
      "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", output,
    ], { timeout: 60_000, maxBuffer: 2_000_000 });
    return { audio: new Uint8Array(await readFile(output)), contentType: "audio/wav" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
