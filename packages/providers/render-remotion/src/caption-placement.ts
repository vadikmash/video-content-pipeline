import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const WIDTH = 108;
const HEIGHT = 192;
export type CaptionPosition = "top" | "bottom";
const POSITIONS: CaptionPosition[] = ["bottom", "top"];

/** Score the same portrait crop the renderer uses. Edges and local contrast approximate visual detail. */
export function quietCaptionPosition(frames: readonly Uint8Array[], allowTop = true): CaptionPosition {
  const scores = new Map<CaptionPosition, number>(POSITIONS.map((position) => [position, 0]));
  for (const frame of frames) {
    if (frame.length !== WIDTH * HEIGHT) continue;
    for (const position of POSITIONS) {
      const center = Math.round(HEIGHT * (position.startsWith("top") ? 0.27 : 0.76));
      let sum = 0;
      let squares = 0;
      let edges = 0;
      let count = 0;
      const left = 9;
      const right = 99;
      for (let y = center - 15; y < center + 15; y++) {
        for (let x = left; x < right; x++) {
          const index = y * WIDTH + x;
          const value = frame[index]!;
          sum += value;
          squares += value * value;
          edges += Math.abs(value - frame[index - 1]!) + Math.abs(value - frame[index - WIDTH]!);
          count++;
        }
      }
      scores.set(position, scores.get(position)! + Math.sqrt(Math.max(0, squares / count - (sum / count) ** 2)) + 2 * edges / count);
    }
  }
  // Prefer the lower safe area unless the upper area is meaningfully quieter.
  const score = (position: CaptionPosition) => scores.get(position)! / Math.max(frames.length, 1) +
    (position === "top" ? 6 : 0);
  return POSITIONS.filter((position) => allowTop || !position.startsWith("top")).reduce((best, position) => score(position) < score(best) ? position : best, "bottom");
}

export async function captionPositionFor(
  url: string,
  kind: "video" | "image",
  durationSec: number,
  allowTop = true,
): Promise<CaptionPosition> {
  const sampleTimes = kind === "image" ? [0] : [0, durationSec * 0.45, durationSec * 0.85];
  const frames: Uint8Array[] = [];
  try {
    for (const time of sampleTimes) {
      const { stdout } = await run("ffmpeg", [
        "-v", "error", "-ss", String(Math.max(0, time)), "-i", url,
        "-frames:v", "1", "-vf", `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=gray`,
        "-f", "rawvideo", "pipe:1",
      ], { encoding: "buffer", timeout: 20_000, maxBuffer: WIDTH * HEIGHT * 2 });
      frames.push(stdout);
    }
  } catch {
    console.warn("Caption placement analysis unavailable for a scene. Using the lower safe area.");
    return "bottom";
  }
  return quietCaptionPosition(frames, allowTop);
}
