/**
 * Draft or full preview of the fixture's b3-b5 span through Renderer.preview:
 * the worker renders the authored layer, the trusted composition adds voice and captions.
 *   tsx scripts/sequence-preview.ts <blobDir> <narration.wav> draft|full [frame,frame,...]
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderInput } from "@vcp/core";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import { createRemotionRenderer } from "../src/index";
import { createDockerSequenceWorker } from "../src/sequence-worker";
import { fixture, fixtureSequence } from "../test/sequence-fixture";

const [blobDir, narrationWav, profile = "draft", frameList] = process.argv.slice(2);
if (!blobDir || !narrationWav || (profile !== "draft" && profile !== "full")) throw new Error("usage: sequence-preview.ts <blobDir> <narration.wav> draft|full [frames]");
const root = path.resolve(fileURLToPath(import.meta.url), "../../../../..");
const projectId = "popcorn-fixture";
const source = await readFile(path.join(root, "fixtures/animation/popcorn-kernel.tsx"), "utf8");
const blob = createLocalBlobStore({ dir: path.resolve(blobDir) });
const built = fixtureSequence(projectId, source);
await blob.put(built.manifestRef.key, built.manifestBytes, "application/json");
await blob.put(built.manifest.source.key, built.sourceBytes, "text/plain");
const audioKey = `projects/${projectId}/narration/popcorn.wav`;
await mkdir(path.dirname(path.join(blob.dir, audioKey)), { recursive: true });
await copyFile(narrationWav, path.join(blob.dir, audioKey));
const input = {
  projectId,
  storyboard: { id: "fixture-storyboard", projectId, narrationId: fixture.provenance.narrationId, version: 1, scenes: built.scenes, containsSyntheticMedia: false, provider: "fixture", createdAt: new Date().toISOString() },
  narration: { audioBlob: { key: audioKey, contentType: "audio/wav" }, words: fixture.words, durationSec: fixture.narrationDurationSec },
  bundle: {},
  template: { id: "fact-short", version: "1.8.0" },
  title: "Popcorn pilot fixture",
  beats: Object.fromEntries([["hook", fixture.script.hook], ...fixture.script.beats.map((b: { id: string; text: string }) => [b.id, b.text]), ["outro", fixture.script.outro]]),
} as unknown as RenderInput;
const frames = frameList ? frameList.split(",").map(Number) : [384, 476, 477, 607, 715];
const started = Date.now();
const renderer = createRemotionRenderer(blob, { concurrency: 2, sequenceWorker: createDockerSequenceWorker(), timeoutMs: 30 * 60_000 });
const preview = await renderer.preview!(input, { profile, startFrame: built.span.startFrame, endFrame: built.span.endFrame, frames });
console.log(JSON.stringify({ ...preview, dir: blob.dir, elapsedMs: Date.now() - started }, null, 2));
