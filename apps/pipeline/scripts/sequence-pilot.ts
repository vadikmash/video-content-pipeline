/**
 * Slice 3 trial: the configured Claude model directs the popcorn script, then
 * authors, previews and critiques the b3-b5 pilot with at most two revisions.
 *   set -a; . ./.env; set +a
 *   tsx scripts/sequence-pilot.ts <blobDir> <narration.wav> <attemptId>
 * Paid calls. Checkpoints live under projects/popcorn-pilot/animations/attempts/<attemptId>/,
 * so re-running the same attempt id reuses every completed step.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compositionDurationFrames, compositionDurationSec, type RenderInput, type Scene } from "@vcp/core";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import { create as createAnthropic } from "@vcp/provider-llm-anthropic";
import { createDockerSequenceWorker, createRemotionRenderer } from "@vcp/provider-render-remotion";
import { authorSequence, directSequences, type AuthoringEvent, type StepUsage } from "../src/animation/sequence-author";

const [blobDir, narrationWav, attemptId] = process.argv.slice(2);
if (!blobDir || !narrationWav || !attemptId) throw new Error("usage: sequence-pilot.ts <blobDir> <narration.wav> <attemptId>");
const root = path.resolve(fileURLToPath(import.meta.url), "../../../..");
const fixture = JSON.parse(await readFile(path.join(root, "fixtures/animation/popcorn-pilot.json"), "utf8"));
const projectId = "popcorn-pilot";
const FPS = 30;
const PILOT = ["b3", "b4", "b5"];

const blob = createLocalBlobStore({ dir: path.resolve(blobDir) });
const audioKey = `projects/${projectId}/narration/popcorn.wav`;
await mkdir(path.dirname(path.join(blob.dir, audioKey)), { recursive: true });
await copyFile(narrationWav, path.join(blob.dir, audioKey));

// The effective binding of the earlier trial (providers_config in vcp_claude_trial): Opus 5.5, high effort.
const binding = { model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5", effort: "high" };
const model = createAnthropic({ env: process.env, options: binding, blob });
// Every response's usage goes to the log as it arrives, so a step that later fails is still accounted for.
const text: typeof model = {
  ...model,
  generate: (schema, prompt) => model.generate(schema, {
    ...prompt,
    onUsage: (u) => {
      console.log(JSON.stringify({ usage: { ...u, step: prompt.context?.step }, at: new Date().toISOString() }));
      prompt.onUsage?.(u);
    },
    onInvalidOutput: (issues, repair) => {
      console.log(JSON.stringify({ invalidOutput: { step: prompt.context?.step, repair, issues: issues.slice(0, 2000) }, at: new Date().toISOString() }));
      prompt.onInvalidOutput?.(issues, repair);
    },
  }),
};
const renderer = createRemotionRenderer(blob, { concurrency: 2, sequenceWorker: createDockerSequenceWorker(), timeoutMs: 30 * 60_000 });

const scenes: Scene[] = fixture.scenes.map((s: Scene) => ({ beatId: s.beatId, start: s.start, end: s.end, visual: { kind: "type" } }));
const beats = Object.fromEntries([["hook", fixture.script.hook], ...fixture.script.beats.map((b: { id: string; text: string }) => [b.id, b.text]), ["outro", fixture.script.outro]]);
const renderInput = (storyboardScenes: Scene[]) => ({
  projectId,
  storyboard: { id: `pilot-${attemptId}`, projectId, narrationId: fixture.provenance.narrationId, version: 1, scenes: storyboardScenes, containsSyntheticMedia: false, provider: "sequence-pilot", createdAt: new Date().toISOString() },
  narration: { audioBlob: { key: audioKey, contentType: "audio/wav" }, words: fixture.words, durationSec: fixture.narrationDurationSec },
  bundle: {},
  template: { id: "fact-short", version: "1.8.0" },
  title: "Why popcorn pops",
  beats,
} as unknown as RenderInput);

const input = {
  projectId,
  attemptId,
  title: "Why popcorn pops",
  script: fixture.script,
  narration: { id: fixture.provenance.narrationId, words: fixture.words, durationSec: fixture.narrationDurationSec },
  scenes,
  fps: FPS,
  durationFrames: compositionDurationFrames(compositionDurationSec(fixture.narrationDurationSec, scenes.map((s) => s.end)), FPS),
  seed: 1729,
};
const events: (AuthoringEvent & { at: string })[] = [];
const deps = {
  text,
  blob,
  renderer,
  renderInput,
  log: (event: AuthoringEvent) => {
    const entry = { ...event, at: new Date().toISOString() };
    events.push(entry);
    console.log(JSON.stringify(entry));
  },
};

const started = Date.now();
const { direction, usage: directionUsage } = await directSequences(deps, input);
const containing = direction.sequences.find((s) => s.beatIds.includes("b4"))!;
const outcome = await authorSequence(deps, input, direction, { sequenceId: containing.sequenceId, beatIds: PILOT });
const usage: StepUsage[] = [...directionUsage, ...outcome.attempts.flatMap((a) => a.usage)];
const summary = {
  attemptId,
  binding,
  status: outcome.status,
  sequenceId: outcome.sequenceId,
  attempts: outcome.attempts.map((a) => ({
    ordinal: a.ordinal,
    verdict: a.verdict,
    failedCriteria: a.failedCriteria,
    diagnostics: a.diagnostics,
    manifest: a.manifest?.ref,
    preview: a.preview && { video: a.preview.video.key, frames: a.preview.frames.map((f) => ({ frame: f.frame, key: f.blob.key })) },
    revisionNotes: a.draft.revisionNotes,
    elapsedMs: a.elapsedMs,
    findings: a.critique?.findings,
    summary: a.critique?.summary,
  })),
  usage,
  totals: usage.reduce((t, u) => ({ input: t.input + (u.inputTokens ?? 0), output: t.output + (u.outputTokens ?? 0), calls: t.calls + 1 }), { input: 0, output: 0, calls: 0 }),
  elapsedMs: Date.now() - started,
  events,
};
await writeFile(path.join(blob.dir, `pilot-${attemptId}.json`), `${JSON.stringify({ direction, ...summary }, null, 2)}\n`);
console.log(JSON.stringify({ status: summary.status, attempts: summary.attempts.map((a) => [a.ordinal, a.verdict, a.failedCriteria]), totals: summary.totals, elapsedMs: summary.elapsedMs }));
