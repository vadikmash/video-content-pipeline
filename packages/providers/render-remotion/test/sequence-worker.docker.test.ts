/**
 * Real container runs of the sequence worker. Needs Docker and the worker image:
 *   pnpm animation-worker:build
 *   ANIMATION_WORKER=1 pnpm --filter @vcp/provider-render-remotion exec vitest run test/sequence-worker.docker.test.ts
 * Each render bundles and renders in a fresh container, so this takes minutes.
 * Set ANIMATION_WORKER_OUT to keep the rendered files for inspection.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import type { RenderInput } from "@vcp/core";
import { createDockerSequenceWorker, SequenceWorkerError, type SequenceWorker } from "../src/sequence-worker";
import { resolveSequences } from "../src/sequences";
import { FPS, fixture, fixtureDurationFrames, fixtureJob, fixtureSequence } from "./sequence-fixture";

const enabled = process.env.ANIMATION_WORKER === "1";
const source = readFileSync(new URL("../../../../fixtures/animation/popcorn-kernel.tsx", import.meta.url), "utf8");
const keep = process.env.ANIMATION_WORKER_OUT;
const MINUTES = 60_000;

function probe(file: string) {
  const out = execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames", "-of", "json", file], { encoding: "utf8" });
  return (JSON.parse(out) as { streams: Record<string, string | number>[] }).streams;
}

describe.skipIf(!enabled)("sequence worker container", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vcp-seq-test-"));
  const blob = createLocalBlobStore({ dir });
  // Bundling dominates on a busy machine; the timeout test below sets its own short limit.
  const worker = createDockerSequenceWorker({ limits: { timeoutMs: 120 * 60_000 } });
  let runs = 0;
  const counted: SequenceWorker = { image: worker.image, run: (job, options) => { runs++; return worker.run(job, options); } };
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const built = fixtureSequence("p-worker", source);
  const input = {
    projectId: "p-worker",
    storyboard: { id: "sb", projectId: "p-worker", narrationId: fixture.provenance.narrationId, version: 1, scenes: built.scenes, containsSyntheticMedia: false, provider: "test", createdAt: new Date().toISOString() },
    narration: { audioBlob: { key: "a.wav", contentType: "audio/wav" }, words: fixture.words, durationSec: fixture.narrationDurationSec },
    bundle: {}, template: { id: "fact-short", version: "1.8.0" }, title: "t", beats: {},
  } as unknown as RenderInput;

  it.each(["draft", "full"] as const)("renders the fixture in the %s profile with exact frames and no audio, then reuses it", async (profile) => {
    await blob.put(built.manifestRef.key, built.manifestBytes, "application/json");
    await blob.put(built.manifest.source.key, built.sourceBytes, "text/plain");
    const options = { fps: FPS, durationFrames: fixtureDurationFrames(), profile, captionPositions: {} };
    const before = runs;
    const first = (await resolveSequences(input, blob, counted, options)).get("popcorn-mechanism")!;
    expect(first.cached).toBe(false);
    const streams = probe(path.join(dir, first.intermediate.key));
    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({
      codec_type: "video",
      codec_name: profile === "draft" ? "h264" : "prores",
      width: profile === "draft" ? 540 : 1080,
      height: profile === "draft" ? 960 : 1920,
      r_frame_rate: "30/1",
      nb_read_frames: "332",
    });
    if (keep) {
      mkdirSync(keep, { recursive: true });
      writeFileSync(path.join(keep, path.basename(first.intermediate.key)), readFileSync(path.join(dir, first.intermediate.key)));
    }
    const second = (await resolveSequences(input, blob, counted, options)).get("popcorn-mechanism")!;
    expect(second).toMatchObject({ cached: true, intermediate: { key: first.intermediate.key } });
    expect(runs).toBe(before + 1);
  }, 90 * MINUTES);

  it("renders identical frames when seeking in shuffled order", async () => {
    const ascending = [0, 21, 75, 92, 93, 150, 189, 190, 222, 223, 224, 278, 300, 331];
    const shuffled = [223, 0, 331, 92, 278, 21, 190, 75, 224, 150, 300, 93, 222, 189];
    const result = await worker.run({ ...fixtureJob(source, "draft"), mode: "stills", frames: [...ascending, ...shuffled] });
    const byFrame = new Map<number, string[]>();
    for (const file of result.files) {
      const frame = Number(/-f(\d+)\.png$/.exec(file.name)![1]);
      byFrame.set(frame, [...(byFrame.get(frame) ?? []), createHash("sha256").update(file.bytes).digest("hex")]);
      if (keep) writeFileSync(path.join(keep, file.name), file.bytes);
    }
    expect(result.files).toHaveLength(28);
    for (const frame of ascending) {
      const hashes = byFrame.get(frame)!;
      expect(hashes, `frame ${frame}`).toHaveLength(2);
      expect(hashes[0], `frame ${frame} differs between orders`).toBe(hashes[1]);
    }
    // Frames around the rupture cue actually change, so equality is not trivial.
    expect(byFrame.get(222)![0]).not.toBe(byFrame.get(224)![0]);
  }, 60 * MINUTES);

  it("reports forbidden imports from inside the container with a line number", async () => {
    const hostile = `import fs from "node:fs";\n${source}`;
    const error = await worker.run({ ...fixtureJob(hostile, "draft") }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SequenceWorkerError);
    expect((error as SequenceWorkerError).kind).toBe("preflight");
    expect((error as SequenceWorkerError).diagnostics[0]).toMatchObject({ stage: "preflight", line: 1 });
    expect((error as SequenceWorkerError).message).toMatch(/node:fs/);
  }, 10 * MINUTES);

  it("cannot reach the network even when a URL slips past preflight", async () => {
    // The daemon may run in a VM, so the canary lives in a container on its own network.
    const docker = (args: string[]) => spawnSync("docker", args, { encoding: "utf8", timeout: 15 * MINUTES });
    const net = `vcp-canary-${Date.now()}`;
    const canary = `${net}-server`;
    try {
      expect(docker(["network", "create", net]).status).toBe(0);
      const started = docker(["run", "-d", "--name", canary, "--network", net, "--entrypoint", "node", worker.image, "-e",
        "require('http').createServer((q, r) => { console.log('HIT ' + q.url); r.end('canary'); }).listen(8080)"]);
      expect(started.status, started.stderr).toBe(0);
      const ip = docker(["inspect", "-f", `{{(index .NetworkSettings.Networks "${net}").IPAddress}}`, canary]).stdout.trim();
      expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);

      // Positive control: a container with networking reaches the canary.
      const control = docker(["run", "--rm", "--network", net, "--entrypoint", "node", worker.image, "-e",
        `fetch("http://${ip}:8080/control").then(r => r.text()).then(t => console.log(t))`]);
      expect(control.stdout.trim(), control.stderr).toBe("canary");

      // Split literals keep each piece innocent; the assembled CSS url() points at the canary.
      const smuggled = source
        .replace("return (\n    <Canvas background", `return (\n    <>\n    <div style={{ position: "absolute", width: 10, height: 10, backgroundImage: "u" + "rl(ht" + "tp:/" + "/${ip}:8080/leak)" }} />\n    <Canvas background`)
        .replace("    </Canvas>\n  );", "    </Canvas>\n    </>\n  );");
      expect(smuggled).toContain("/leak)");
      const result = await worker.run({ ...fixtureJob(smuggled, "draft"), mode: "stills", frames: [0, 223] });
      expect(result.files).toHaveLength(2);

      const hits = docker(["logs", canary]).stdout.split("\n").filter((line) => line.startsWith("HIT "));
      expect(hits).toEqual(["HIT /control"]);
    } finally {
      docker(["rm", "-f", canary]);
      docker(["network", "rm", net]);
    }
  }, 120 * MINUTES);

  it("kills a job that runs past its time limit and leaves no container behind", async () => {
    const spinning = source.replace("const { frame, fps, seed, style } = props;", "const { frame, fps, seed, style } = props;\n  for (let i = 0; i >= 0; i = i * 1) { if (frame < 0) break; }");
    const started = Date.now();
    const error = await worker.run(fixtureJob(spinning, "draft"), { timeoutMs: 4 * MINUTES }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SequenceWorkerError);
    expect((error as SequenceWorkerError).kind).toBe("timeout");
    // Killed at the limit, not when the job would have finished (cleanup is bounded separately).
    expect(Date.now() - started).toBeLessThan(4 * MINUTES + 3 * MINUTES);
    const left = execFileSync("docker", ["ps", "-q", "--filter", "label=vcp.role=sequence-worker"], { encoding: "utf8" }).trim();
    expect(left).toBe("");
  }, 30 * MINUTES);
});
