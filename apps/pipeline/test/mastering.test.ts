import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { masterNarration, NARRATION_TARGET_LUFS } from "../src/audio/mastering";

it("masters quiet audio to the target without shifting caption timing or clipping", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vcp-master-test-"));
  try {
    const input = path.join(dir, "input.wav"), output = path.join(dir, "output.wav");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=f=220:d=5", "-af", "volume=0.4", input]);
    const result = await masterNarration(readFileSync(input));
    expect(result.contentType).toBe("audio/wav");
    writeFileSync(output, result.audio);
    const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", output]).toString());
    expect(Math.abs(duration - 5)).toBeLessThan(0.01);
    const measured = spawnSync("ffmpeg", ["-hide_banner", "-i", output, "-af", "loudnorm=print_format=json", "-f", "null", "-"], {stdio:["ignore","pipe","pipe"]});
    expect(measured.status).toBe(0);
    const levels = JSON.parse(measured.stderr.toString().match(/\{\s*"input_i"[\s\S]*?\}/)![0]);
    expect(Math.abs(Number(levels.input_i) - NARRATION_TARGET_LUFS)).toBeLessThan(0.5);
    expect(Number(levels.input_tp)).toBeLessThanOrEqual(-1.4);
  } finally {
    rmSync(dir, {recursive:true, force:true});
  }
});
