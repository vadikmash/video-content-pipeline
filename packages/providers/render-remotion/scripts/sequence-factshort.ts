/**
 * Assembles the full FactShort for the popcorn fixture: original narration and
 * captions, Backdrop beats outside the pilot, and the authored b3-b5 sequence
 * played from its verified full-profile intermediate.
 *   tsx scripts/sequence-factshort.ts <blobDir> <narration.wav>
 * Renders the intermediate through the worker unless the blob dir already has a verified one.
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderInput } from "@vcp/core";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import { createRemotionRenderer } from "../src/index";
import { createDockerSequenceWorker } from "../src/sequence-worker";
import { fixture, fixtureSequence } from "../test/sequence-fixture";

const [blobDir, narrationWav] = process.argv.slice(2);
if (!blobDir || !narrationWav) throw new Error("usage: sequence-factshort.ts <blobDir> <narration.wav>");
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

const started = Date.now();
const renderer = createRemotionRenderer(blob, { concurrency: 2, sequenceWorker: createDockerSequenceWorker(), timeoutMs: 10 * 60_000 });
const render = await renderer.render(input);
console.log(JSON.stringify({ video: path.join(blob.dir, render.blob.key), durationSec: render.durationSec, templateVersion: render.templateVersion, elapsedMs: Date.now() - started }, null, 2));
