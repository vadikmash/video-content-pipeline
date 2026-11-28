import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { BlobRef, BlobStore, RenderInput } from "@vcp/core";
import { DEFAULT_LIMITS, dockerRunArgs, type SequenceWorker } from "../src/sequence-worker";
import { intermediateKey, resolveSequences } from "../src/sequences";
import { FPS, fixture, fixtureDurationFrames, fixtureSequence } from "./sequence-fixture";

const source = readFileSync(new URL("../../../../fixtures/animation/popcorn-kernel.tsx", import.meta.url), "utf8");

function memoryBlob(): BlobStore & { data: Map<string, Uint8Array> } {
  const data = new Map<string, Uint8Array>();
  return {
    id: "memory",
    data,
    async put(key, bytes, contentType) {
      data.set(key, bytes);
      return { key, contentType, size: bytes.byteLength } satisfies BlobRef;
    },
    async get(ref) {
      const bytes = data.get(ref.key);
      if (!bytes) throw new Error(`missing ${ref.key}`);
      return bytes;
    },
    async url(ref) {
      return `memory://${ref.key}`;
    },
  };
}

function setup(projectId = "p1") {
  const blob = memoryBlob();
  const built = fixtureSequence(projectId, source);
  blob.data.set(built.manifestRef.key, built.manifestBytes);
  blob.data.set(built.manifest.source.key, built.sourceBytes);
  const input = {
    projectId,
    storyboard: { id: "sb", projectId, narrationId: fixture.provenance.narrationId, version: 1, scenes: built.scenes, containsSyntheticMedia: false, provider: "test", createdAt: new Date().toISOString() },
    narration: { audioBlob: { key: "a.wav", contentType: "audio/wav" }, words: fixture.words, durationSec: fixture.narrationDurationSec },
    bundle: {}, template: { id: "fact-short", version: "1.8.0" }, title: "t", beats: {},
  } as unknown as RenderInput;
  const options = { fps: FPS, durationFrames: fixtureDurationFrames(), profile: "full" as const, captionPositions: {} };
  return { blob, built, input, options };
}

const neverWorker: SequenceWorker = { image: "none", run: vi.fn(async () => { throw new Error("worker should not run"); }) };

describe("docker isolation flags", () => {
  const args = dockerRunArgs("vcp-seq-test", "vcp-animation-worker:1.0.0", DEFAULT_LIMITS);
  it("runs without network, host files, environment or privileges", () => {
    const joined = args.join(" ");
    expect(joined).toContain("--network none");
    expect(args).toContain("--read-only");
    expect(joined).toContain("--cap-drop ALL");
    expect(joined).toContain("--security-opt no-new-privileges");
    expect(joined).toContain("--user 10001:10001");
    for (const flag of ["-v", "--volume", "--mount", "-e", "--env", "--env-file", "--privileged", "--device", "-p", "--publish", "--add-host"]) {
      expect(args, flag).not.toContain(flag);
    }
    expect(joined).not.toMatch(/docker\.sock|\.env|DATABASE_URL|API_KEY/);
    expect(args[args.length - 1]).toBe("vcp-animation-worker:1.0.0");
  });
  it("bounds memory, CPU, processes and scratch space", () => {
    const joined = args.join(" ");
    expect(joined).toContain("--memory 3g --memory-swap 3g");
    expect(joined).toContain("--cpus 2");
    expect(joined).toContain("--pids-limit 512");
    expect(joined).toMatch(/--tmpfs \/tmp:rw,noexec,nosuid,nodev,size=1536m/);
    expect(joined).toMatch(/--tmpfs \/app\/job:rw,noexec,nosuid,nodev,size=512m/);
  });
});

describe("resolveSequences", () => {
  it("reuses a verified intermediate by manifest digest without starting the worker", async () => {
    const { blob, built, input, options } = setup();
    const keys = intermediateKey("p1", "popcorn-mechanism", built.manifestRef.digest, "full");
    const video = new TextEncoder().encode("verified-video");
    const { sha256Hex } = await import("@vcp/core");
    blob.data.set(keys.video, video);
    blob.data.set(keys.record, new TextEncoder().encode(JSON.stringify({ manifestDigest: built.manifestRef.digest, profile: "full", frames: 332, sha256: sha256Hex(video) })));
    const resolved = await resolveSequences(input, blob, neverWorker, options);
    expect(resolved.get("popcorn-mechanism")).toMatchObject({ cached: true, startFrame: 384, endFrame: 716, intermediate: { key: keys.video } });
    expect(neverWorker.run).not.toHaveBeenCalled();
  });

  it("re-renders when the cached bytes no longer match their record", async () => {
    const { blob, built, input, options } = setup();
    const keys = intermediateKey("p1", "popcorn-mechanism", built.manifestRef.digest, "full");
    blob.data.set(keys.video, new TextEncoder().encode("tampered"));
    blob.data.set(keys.record, new TextEncoder().encode(JSON.stringify({ manifestDigest: built.manifestRef.digest, profile: "full", frames: 332, sha256: "0".repeat(64) })));
    await expect(resolveSequences(input, blob, neverWorker, options)).rejects.toThrow(/should not run/);
  });

  it("rejects tampered manifests and sources and refs outside the project", async () => {
    const tampered = setup();
    tampered.blob.data.set(tampered.built.manifestRef.key, new TextEncoder().encode("{}"));
    await expect(resolveSequences(tampered.input, tampered.blob, neverWorker, tampered.options)).rejects.toThrow(/does not match its digest/);

    const badSource = setup();
    badSource.blob.data.set(badSource.built.manifest.source.key, new TextEncoder().encode("export default 1"));
    await expect(resolveSequences(badSource.input, badSource.blob, neverWorker, badSource.options)).rejects.toThrow(/Sequence source .* does not match/);

    const foreign = setup("p1");
    const other = fixtureSequence("p2", source);
    foreign.blob.data.set(other.manifestRef.key, other.manifestBytes);
    (foreign.input.storyboard as { scenes: unknown }).scenes = other.scenes;
    await expect(resolveSequences(foreign.input, foreign.blob, neverWorker, foreign.options)).rejects.toThrow(/outside project p1/);
  });

  it("refuses to play a sequence against retimed narration", async () => {
    const { blob, input, options } = setup();
    input.narration.words = input.narration.words.map((w, i) => (i === 59 ? { ...w, start: w.start + 0.3 } : w));
    await expect(resolveSequences(input, blob, neverWorker, options)).rejects.toThrow(/timing changed/);
  });

  it("passes only the sequence props to the worker and rejects malformed output", async () => {
    const { blob, input, options } = setup();
    const run = vi.fn<SequenceWorker["run"]>(async () => ({ files: [{ name: "visual.mov", bytes: Buffer.from("not a video") }], diagnostics: [], image: "x", imageId: "sha256:x", elapsedMs: 1 }));
    await expect(resolveSequences(input, blob, { image: "x", run }, options)).rejects.toThrow();
    const job = run.mock.calls[0]![0];
    expect(job).toMatchObject({ mode: "video", profile: "full", source });
    expect(job.sequence).toMatchObject({ fps: 30, durationInFrames: 332, seed: 1729, cues: { heats: 21, ruptures: 223, expands: 278 } });
    expect(job.sequence.beats.map((b) => [b.id, b.start, b.end])).toEqual([["b3", 0, 93], ["b4", 93, 190], ["b5", 190, 332]]);
    expect(Object.keys(job).sort()).toEqual(["mode", "profile", "sequence", "source"]);
    expect([...blob.data.keys()].some((key) => key.includes("/intermediates/"))).toBe(false);
  });
});

describe("preview range", () => {
  it("accepts a half-open range inside the composition and stills inside it", async () => {
    const { assertPreviewRange } = await import("../src/index");
    expect(() => assertPreviewRange(384, 716, [384, 607, 715], 1173)).not.toThrow();
    expect(() => assertPreviewRange(384, 716, [716], 1173)).toThrow(/outside \[384, 716\)/);
    expect(() => assertPreviewRange(700, 1174, [], 1173)).toThrow(/outside the composition/);
    expect(() => assertPreviewRange(10, 10, [], 1173)).toThrow();
  });
});
