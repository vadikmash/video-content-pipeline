/**
 * Claude-authored sequences: a direction pass over the whole script, then for
 * one sequence an author -> draft preview -> framed visual critique loop with
 * at most two revisions. Every paid step is checkpointed in the blob store
 * before the loop moves on, so a retry of the same attempt reuses it.
 *
 * Product wiring (storyboard stage, review conversion, DB claims) is slice 4;
 * this module takes its ports explicitly so a trial script and tests can run it.
 */
import {
  CRITIQUE_CRITERIA,
  SequenceAuthorDraft,
  SequenceCritique,
  SequenceDirection,
  buildSequenceManifest,
  captionBox,
  critiqueVerdict,
  poseSet,
  sequencePrefix,
  sequenceSpans,
  sha256Hex,
  validateDirection,
  type BlobRef,
  type BlobStore,
  type CritiqueFinding,
  type DirectedSequence,
  type Preview,
  type PromptImage,
  type PromptUsage,
  type RenderInput,
  type Renderer,
  type Scene,
  type SequenceManifest,
  type SequenceSpan,
  type TextModel,
  type Word,
} from "@vcp/core";
import { WORKER_VERSION } from "@vcp/animation-worker/job";
import { EXAMPLE_SEQUENCE, REFERENCE_VERSION, TOOLKIT_REFERENCE } from "@vcp/animation-worker/reference";
import { CAPTION_LAYOUT } from "@vcp/renderer/props";
import { TOOLKIT_VERSION } from "@vcp/renderer/motion-version";

export const SEQUENCE_PROMPT_VERSION = 1;
export const MAX_SEQUENCE_REVISIONS = 2;
export const AUTHOR_MAX_OUTPUT_TOKENS = 64_000;
export const MAX_CRITIQUE_FRAMES = 18;

export interface SequenceScript {
  hook: string;
  beats: { id: string; text: string }[];
  outro: string;
  claims: { text: string; sourceUrl?: string }[];
}

export interface SequenceAuthoringInput {
  projectId: string;
  /** Owner of this creative attempt (a review request id or a trial id). */
  attemptId: string;
  title: string;
  script: SequenceScript;
  narration: { id: string; words: Word[]; durationSec: number };
  /** Timed storyboard scenes; their visuals outside authored sequences are kept. */
  scenes: Scene[];
  fps: number;
  durationFrames: number;
  seed: number;
}

export interface SequenceAuthoringDeps {
  text: TextModel;
  blob: BlobStore;
  renderer: Renderer;
  /** Build the render input for a storyboard with the given scenes. */
  renderInput(scenes: Scene[]): RenderInput;
  log?(event: AuthoringEvent): void;
  signal?: AbortSignal;
}

export type AuthoringStep = "direction" | "author" | "compile" | "preview" | "critique";

export interface AuthoringEvent {
  step: AuthoringStep;
  sequenceId?: string;
  ordinal?: number;
  outcome: "started" | "done" | "cached" | "failed";
  elapsedMs?: number;
  detail?: string;
}

export interface StepUsage extends PromptUsage {
  step: AuthoringStep;
  ordinal?: number;
}

export interface AttemptCheckpoint {
  promptVersion: number;
  sequenceId: string;
  ordinal: number;
  inputDigest: string;
  draft: SequenceAuthorDraft;
  manifest?: { ref: { key: string; digest: string }; value: SequenceManifest };
  preview?: Pick<Preview, "id" | "profile" | "startFrame" | "endFrame" | "width" | "height" | "video" | "frames">;
  diagnostics: string[];
  critique?: SequenceCritique;
  verdict: "pass" | "revise";
  failedCriteria: string[];
  usage: StepUsage[];
  elapsedMs: Partial<Record<AuthoringStep, number>>;
}

export type SequenceOutcome =
  | { status: "accepted"; sequenceId: string; checkpoint: AttemptCheckpoint; scenes: Scene[]; attempts: AttemptCheckpoint[] }
  | { status: "rejected"; sequenceId: string; attempts: AttemptCheckpoint[]; failedCriteria: string[] };

// ---------------------------------------------------------------------------
// Keys and checkpoints
// ---------------------------------------------------------------------------

function attemptPrefix(projectId: string, attemptId: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(attemptId)) throw new Error(`Invalid attempt id ${attemptId}`);
  return `${sequencePrefix(projectId)}attempts/${attemptId}/`;
}

async function readJson<T>(blob: BlobStore, key: string): Promise<T | undefined> {
  try {
    return JSON.parse(new TextDecoder().decode(await blob.get({ key, contentType: "application/json" }))) as T;
  } catch {
    return undefined;
  }
}

async function writeJson(blob: BlobStore, key: string, value: unknown): Promise<BlobRef> {
  return blob.put(key, new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`), "application/json");
}

/** Everything a direction depends on; a change seeds a new direction rather than reusing a stale one. */
export function directionDigest(text: TextModel, input: SequenceAuthoringInput): string {
  return sha256Hex(JSON.stringify({
    v: SEQUENCE_PROMPT_VERSION,
    model: text.capabilities?.model ?? text.id,
    script: input.script,
    words: input.narration.words.map((w) => [w.text, w.start, w.end]),
    beats: input.scenes.map((s) => [s.beatId, s.start, s.end]),
  }));
}

// ---------------------------------------------------------------------------
// Context shared by prompts
// ---------------------------------------------------------------------------

function beatText(script: SequenceScript, beatId: string): string {
  if (beatId === "hook") return script.hook;
  if (beatId === "outro") return script.outro;
  return script.beats.find((beat) => beat.id === beatId)?.text ?? "";
}

function timedBeats(input: SequenceAuthoringInput) {
  return [...input.scenes].sort((a, b) => a.start - b.start).map((scene) => ({
    beatId: scene.beatId,
    start: scene.start,
    end: scene.end,
    text: beatText(input.script, scene.beatId),
  }));
}

/** Frame span a planned sequence would occupy, using the renderer's timeline policy. */
export function plannedSpan(input: SequenceAuthoringInput, sequence: Pick<DirectedSequence, "sequenceId" | "beatIds">): SequenceSpan {
  const placeholder = { key: `${sequencePrefix(input.projectId)}planned`, digest: "0".repeat(64) };
  const scenes = input.scenes.map((scene) => sequence.beatIds.includes(scene.beatId)
    ? { ...scene, visual: { kind: "animationSequence" as const, sequenceId: sequence.sequenceId, manifest: placeholder, description: "planned" } }
    : { ...scene, visual: { kind: "type" as const } });
  const span = sequenceSpans(scenes, input.fps, input.durationFrames).find((s) => s.sequenceId === sequence.sequenceId);
  if (!span) throw new Error(`Sequence ${sequence.sequenceId} has no frames`);
  return span;
}

function captionPosition(scene: Scene | undefined): "top" | "bottom" {
  return scene?.captionPosition?.startsWith("top") ? "top" : "bottom";
}

function spanWords(input: SequenceAuthoringInput, span: SequenceSpan) {
  return input.narration.words.flatMap((word, index) => {
    const frame = Math.round(word.start * input.fps);
    return frame >= span.startFrame && frame < span.endFrame
      ? [{ i: index, w: word.text, startFrame: frame, endFrame: Math.round(word.end * input.fps) }]
      : [];
  });
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const DIRECTOR_SYSTEM = `You are the art director for a 1080x1920 vertical explainer animation drawn as flat-shaded scientific SVG.
Plan continuous authored sequences that explain the narrated mechanism. Ground every visual in the approved claims; never add facts.`;

export function directionPrompt(input: SequenceAuthoringInput) {
  return {
    kind: "animation" as const,
    system: DIRECTOR_SYSTEM,
    user: `Plan the whole video as a small number of continuous sequences.

Rules
- Cover every timed beat exactly once, in order; each sequence is a contiguous run of beats (hook and outro included).
- Group beats that show one physical process so its objects keep one geometry and one visual clock across beat boundaries.
- Name persistent objects with lowerCamel or kebab ids and give each a role.
- For each sequence say what the mechanism is, how framing and scale change, and how it starts relative to the previous one (continuous, or a planned cut and its purpose).
- keyCues are the spoken words that motion must land on.
- Choose one palette (named hex colors, including "background") and short style notes covering silhouette, light direction and three depth layers.
- mechanismSequenceId is the sequence that shows the core physical change; it is authored first.

Title: ${input.title}`,
    context: {
      step: "direction",
      claims: input.script.claims,
      beats: timedBeats(input).map((b) => ({ ...b, startSec: b.start, endSec: b.end })),
    },
  };
}

const AUTHOR_SYSTEM = `You write one Remotion sequence as a pure TSX module that draws an explanatory SVG animation for a vertical 1080x1920 video.
You follow the module contract exactly, keep motion tied to named narration cues, and keep caption boxes clear of key geometry.`;

export interface AuthorContext {
  input: SequenceAuthoringInput;
  direction: SequenceDirection;
  sequence: DirectedSequence;
  span: SequenceSpan;
  previous?: { draft: SequenceAuthorDraft; findings: CritiqueFinding[]; diagnostics: string[] };
}

export function authorPrompt({ input, direction, sequence, span, previous }: AuthorContext) {
  const byBeat = new Map(input.scenes.map((scene) => [scene.beatId, scene]));
  const beats = span.beats.map((beat) => ({
    id: beat.beatId,
    text: beatText(input.script, beat.beatId),
    localStart: beat.start - span.startFrame,
    localEnd: beat.end - span.startFrame,
    captionBox: captionBox(captionPosition(byBeat.get(beat.beatId)), CAPTION_LAYOUT),
  }));
  const revision = previous
    ? `

This is a revision. Keep what works and fix every finding marked revise. Describe the change in revisionNotes.
${previous.diagnostics.length ? `Compiler/validator diagnostics from the previous source:\n${previous.diagnostics.map((d) => `- ${d}`).join("\n")}\n` : ""}${previous.findings.length ? `Critique findings (global frames; subtract ${span.startFrame} for local frames):\n${previous.findings.map((f) => `- [${f.verdict}] ${f.criterion} @${f.frame}: ${f.observed}${f.change ? ` -> ${f.change}` : ""}`).join("\n")}\n` : ""}
Previous source:
\`\`\`tsx
${previous.draft.source}
\`\`\``
    : "";
  return {
    kind: "animation" as const,
    // High-effort reasoning plus a full TSX module overran 32K on the first real run.
    maxOutputTokens: AUTHOR_MAX_OUTPUT_TOKENS,
    system: AUTHOR_SYSTEM,
    user: `Author sequence "${sequence.sequenceId}" covering beats ${span.beatIds.join(", ")}.
It plays for ${span.endFrame - span.startFrame} frames at ${input.fps} fps (global frames ${span.startFrame}-${span.endFrame - 1}); local frame 0 is global frame ${span.startFrame}.

Return
- cues: bind each motion beat to a narration word by its global index i and edge (start/end), with an optional offset of -30..30 frames for anticipation or follow-through. Cue frames must land inside the sequence. Read them in the module with cueFrame(cues, name).
- poses: the start and end pose of each object visible at that edge (design coordinates of its key geometry; width, height and scale above 0). Leave out an object that is absent at an edge. Neighbouring sequences use them to join.
- source: the complete module.
- description: one sentence for editors.

Picture
- Show the mechanism so it reads with captions hidden: a recognizable silhouette, materials distinguishable by shape and position, and framing that moves attention to the active material.
- Motion: build up gradually, make the main action perceptibly faster, then follow through and settle. Keep one clock and stable object coordinates across the internal beat boundaries.
- Keep key geometry and any labels out of each beat's captionBox (captions are drawn on top by the template). Prefer no text labels.

Module contract and toolkit
${TOOLKIT_REFERENCE}

Example of the module shape (a different topic; do not copy its picture):
\`\`\`tsx
${EXAMPLE_SEQUENCE}
\`\`\`${revision}`,
    context: {
      step: "author",
      claims: input.script.claims,
      style: { notes: direction.styleNotes, palette: direction.palette },
      sequence,
      neighbours: direction.sequences.filter((s) => s.sequenceId !== sequence.sequenceId).map((s) => ({ sequenceId: s.sequenceId, beatIds: s.beatIds, mechanism: s.mechanism })),
      beats,
      words: spanWords(input, span),
    },
  };
}

const CRITIC_SYSTEM = `You are a strict editorial reviewer of explainer animation for vertical video. You judge only what the frames show.`;

export interface CritiqueContext {
  input: SequenceAuthoringInput;
  sequence: DirectedSequence;
  span: SequenceSpan;
  manifest: SequenceManifest;
  frames: { frame: number; timeSec: number; label: string }[];
  previousFindings: CritiqueFinding[];
}

export function critiquePrompt({ input, sequence, span, manifest, frames, previousFindings }: CritiqueContext) {
  return {
    kind: "animation" as const,
    system: CRITIC_SYSTEM,
    user: `The images are draft frames (540x960, captions drawn by the template) from sequence "${sequence.sequenceId}", global frames ${span.startFrame}-${span.endFrame - 1}, in time order. Each is labelled with its global frame, time, beat and the cue it samples.
They sample cue onsets, follow-through a few frames later and both sides of each internal beat boundary. Judge motion from what changes between consecutive frames.

Give one finding per criterion at least (more where useful), each with the exact global frame it refers to, what you observe, the concrete change you want (empty when it passes), and pass or revise:
- mechanism: with captions ignored, the physical steps in the plan are distinguishable in order, and each happens at its cue.
- art: the subject reads as itself at phone size; materials stay distinguishable by shape and position; clear silhouette and depth; framing directs attention to the active material.
- continuity: geometry, material identities and developing state carry across the beat boundaries; no blank frames, reset poses or accidental jumps.
- motion: build-up accumulates over time, the main action is visibly faster, there is an identifiable origin, and follow-through settles; camera moves keep the point of interest.
- delivery: captions are legible and do not cover key geometry; nothing is cropped or off-canvas that matters.
Pass a criterion only when the frames show it. Do not ask for facts beyond the claims.`,
    context: {
      step: "critique",
      claims: input.script.claims,
      plan: { mechanism: sequence.mechanism, framing: sequence.framing, keyCues: sequence.keyCues },
      beats: span.beats.map((b) => ({ id: b.beatId, startFrame: b.start, endFrame: b.end, text: beatText(input.script, b.beatId) })),
      cues: manifest.cues.map((c) => ({ name: c.name, frame: c.frame, word: input.narration.words[c.word]?.text })),
      frames,
      previousFindings,
    },
  };
}

// ---------------------------------------------------------------------------
// Frame sampling
// ---------------------------------------------------------------------------

/** Cue onsets, follow-through, beat boundaries and the ends, bounded and in order. */
export function critiqueFrames(span: SequenceSpan, cues: readonly { name: string; frame: number }[], max = MAX_CRITIQUE_FRAMES) {
  const labels = new Map<number, string[]>();
  const add = (frame: number, label: string) => {
    if (frame < span.startFrame || frame >= span.endFrame) return;
    labels.set(frame, [...(labels.get(frame) ?? []), label]);
  };
  add(span.startFrame, "sequence start");
  add(span.endFrame - 1, "settled end");
  for (const beat of span.beats.slice(1)) {
    add(beat.start - 1, `before ${beat.beatId}`);
    add(beat.start, `${beat.beatId} starts`);
  }
  for (const cue of cues) {
    add(cue.frame, `cue ${cue.name}`);
    add(cue.frame + 6, `${cue.name} +6`);
  }
  let frames = [...labels.keys()].sort((a, b) => a - b);
  // Thin follow-through frames first, keeping cues, boundaries and the ends.
  while (frames.length > max) {
    const drop = frames.findLast((frame) => labels.get(frame)!.every((label) => label.endsWith("+6")));
    if (drop === undefined) {
      frames = frames.filter((_, index) => index % 2 === 0 || index === frames.length - 1);
      break;
    }
    frames = frames.filter((frame) => frame !== drop);
  }
  return frames.map((frame) => ({ frame, label: labels.get(frame)!.join(", ") }));
}

function beatOf(span: SequenceSpan, frame: number): string {
  return span.beats.find((beat) => frame >= beat.start && frame < beat.end)?.beatId ?? span.beatIds.at(-1)!;
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

export async function directSequences(deps: SequenceAuthoringDeps, input: SequenceAuthoringInput): Promise<{ direction: SequenceDirection; usage: StepUsage[]; cached: boolean }> {
  const key = `${attemptPrefix(input.projectId, input.attemptId)}direction.json`;
  const digest = directionDigest(deps.text, input);
  const saved = await readJson<{ digest: string; direction: SequenceDirection; usage: StepUsage[] }>(deps.blob, key);
  if (saved?.digest === digest) {
    deps.log?.({ step: "direction", outcome: "cached" });
    return { direction: SequenceDirection.parse(saved.direction), usage: saved.usage, cached: true };
  }
  const usage: StepUsage[] = [];
  const started = Date.now();
  deps.log?.({ step: "direction", outcome: "started" });
  const direction = await deps.text.generate(SequenceDirection, {
    ...directionPrompt(input),
    signal: deps.signal,
    onUsage: (u) => usage.push({ ...u, step: "direction" }),
  });
  validateDirection(direction, timedBeats(input).map((beat) => beat.beatId));
  await writeJson(deps.blob, key, { digest, direction, usage });
  deps.log?.({ step: "direction", outcome: "done", elapsedMs: Date.now() - started });
  return { direction, usage, cached: false };
}

// ---------------------------------------------------------------------------
// Author / preview / critique loop for one sequence
// ---------------------------------------------------------------------------

function isRepairableWorkerError(error: unknown): error is Error & { diagnostics?: { message: string; line?: number }[] } {
  return error instanceof Error && error.name === "SequenceWorkerError" && (error as { repairable?: boolean }).repairable === true;
}

export interface LoopOptions {
  /** Restrict to a subset of beats for a pilot; must match a directed sequence or replace its beats. */
  beatIds?: string[];
  sequenceId?: string;
  maxRevisions?: number;
}

/**
 * Run the bounded loop for one sequence. Returns the accepted checkpoint and the
 * storyboard scenes that reference it, or the rejected attempts with failed criteria.
 * A rejected draft is never promoted.
 */
export async function authorSequence(
  deps: SequenceAuthoringDeps,
  input: SequenceAuthoringInput,
  direction: SequenceDirection,
  options: LoopOptions = {},
): Promise<SequenceOutcome> {
  const directed = direction.sequences.find((s) => s.sequenceId === (options.sequenceId ?? direction.mechanismSequenceId));
  if (!directed) throw new Error(`Sequence ${options.sequenceId} is not in the direction`);
  const sequence: DirectedSequence = options.beatIds ? { ...directed, beatIds: options.beatIds } : directed;
  const span = plannedSpan(input, sequence);
  const maxRevisions = options.maxRevisions ?? MAX_SEQUENCE_REVISIONS;
  const prefix = `${attemptPrefix(input.projectId, input.attemptId)}${sequence.sequenceId}/`;
  const inputDigest = sha256Hex(JSON.stringify({
    v: SEQUENCE_PROMPT_VERSION,
    reference: REFERENCE_VERSION,
    toolkit: TOOLKIT_VERSION,
    worker: WORKER_VERSION,
    model: deps.text.capabilities?.model ?? deps.text.id,
    direction: directionDigest(deps.text, input),
    sequence,
    span: [span.startFrame, span.endFrame, span.beatIds],
    seed: input.seed,
  }));
  if (!deps.text.capabilities?.images) {
    throw new Error(`${deps.text.id} cannot critique frames: the configured model does not accept image input`);
  }
  if (!deps.renderer.preview) throw new Error(`${deps.renderer.id} cannot render previews`);

  const attempts: AttemptCheckpoint[] = [];
  for (let ordinal = 0; ordinal <= maxRevisions; ordinal++) {
    const checkpointKey = `${prefix}${ordinal}.json`;
    const saved = await readJson<AttemptCheckpoint>(deps.blob, checkpointKey);
    if (saved && saved.inputDigest === inputDigest && saved.promptVersion === SEQUENCE_PROMPT_VERSION) {
      deps.log?.({ step: "critique", sequenceId: sequence.sequenceId, ordinal, outcome: "cached", detail: saved.verdict });
      attempts.push(saved);
      if (saved.verdict === "pass") return accepted(input, sequence, saved, attempts);
      continue;
    }
    const checkpoint = await runAttempt(deps, input, direction, sequence, span, ordinal, inputDigest, attempts.at(-1), `${prefix}${ordinal}-draft.json`);
    await writeJson(deps.blob, checkpointKey, checkpoint);
    attempts.push(checkpoint);
    if (checkpoint.verdict === "pass") return accepted(input, sequence, checkpoint, attempts);
  }
  return { status: "rejected", sequenceId: sequence.sequenceId, attempts, failedCriteria: attempts.at(-1)?.failedCriteria ?? [] };
}

function accepted(input: SequenceAuthoringInput, sequence: DirectedSequence, checkpoint: AttemptCheckpoint, attempts: AttemptCheckpoint[]): SequenceOutcome {
  const manifest = checkpoint.manifest!;
  const scenes = input.scenes.map((scene) => sequence.beatIds.includes(scene.beatId)
    ? { ...scene, visual: { kind: "animationSequence" as const, sequenceId: sequence.sequenceId, manifest: manifest.ref, description: manifest.value.description } }
    : scene);
  return { status: "accepted", sequenceId: sequence.sequenceId, checkpoint, scenes, attempts };
}

async function timed<T>(elapsed: Partial<Record<AuthoringStep, number>>, step: AuthoringStep, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await run();
  } finally {
    elapsed[step] = (elapsed[step] ?? 0) + Date.now() - started;
  }
}

async function runAttempt(
  deps: SequenceAuthoringDeps,
  input: SequenceAuthoringInput,
  direction: SequenceDirection,
  sequence: DirectedSequence,
  span: SequenceSpan,
  ordinal: number,
  inputDigest: string,
  previous: AttemptCheckpoint | undefined,
  draftKey: string,
): Promise<AttemptCheckpoint> {
  const usage: StepUsage[] = [];
  const elapsedMs: Partial<Record<AuthoringStep, number>> = {};
  const log = (step: AuthoringStep, outcome: AuthoringEvent["outcome"], detail?: string) =>
    deps.log?.({ step, sequenceId: sequence.sequenceId, ordinal, outcome, elapsedMs: elapsedMs[step], detail });
  const base = { promptVersion: SEQUENCE_PROMPT_VERSION, sequenceId: sequence.sequenceId, ordinal, inputDigest, usage, elapsedMs };

  // 1. Author (or reuse the paid draft saved before an infrastructure failure).
  const savedDraft = await readJson<{ inputDigest: string; draft: SequenceAuthorDraft; usage: StepUsage[] }>(deps.blob, draftKey);
  let draft: SequenceAuthorDraft;
  if (savedDraft?.inputDigest === inputDigest) {
    draft = SequenceAuthorDraft.parse(savedDraft.draft);
    usage.push(...savedDraft.usage);
    log("author", "cached");
  } else {
    log("author", "started");
    const prompt = authorPrompt({
      input, direction, sequence, span,
      previous: previous ? { draft: previous.draft, findings: previous.critique?.findings ?? [], diagnostics: previous.diagnostics } : undefined,
    });
    draft = await timed(elapsedMs, "author", () => deps.text.generate(SequenceAuthorDraft, {
      ...prompt,
      signal: deps.signal,
      onUsage: (u) => usage.push({ ...u, step: "author", ordinal }),
    }));
    await writeJson(deps.blob, draftKey, { inputDigest, draft, usage: [...usage] });
    log("author", "done");
  }

  // 2. Trusted manifest assembly: keys, digests and cue frames. Errors are repairable.
  let built: ReturnType<typeof buildSequenceManifest>;
  try {
    built = buildSequenceManifest({
      projectId: input.projectId,
      sequenceId: sequence.sequenceId,
      description: draft.description,
      span,
      narration: { id: input.narration.id, words: input.narration.words },
      fps: input.fps,
      cues: draft.cues,
      poses: { start: poseSet(draft.poses.start, "start"), end: poseSet(draft.poses.end, "end") },
      style: {
        id: `${sequence.sequenceId}-style`,
        palette: Object.fromEntries(direction.palette.map((color) => [color.name, color.hex])),
        notes: direction.styleNotes.slice(0, 600),
      },
      source: draft.source,
      toolkitVersion: TOOLKIT_VERSION,
      compilerVersion: `vcp-animation-worker:${WORKER_VERSION}`,
      seed: input.seed,
    });
  } catch (error) {
    log("compile", "failed", (error as Error).message);
    return { ...base, draft, diagnostics: [(error as Error).message], verdict: "revise", failedCriteria: ["compile"] };
  }
  await deps.blob.put(built.manifest.source.key, built.sourceBytes, "text/plain; charset=utf-8");
  await deps.blob.put(built.manifestRef.key, built.manifestBytes, "application/json");
  const manifest = { ref: built.manifestRef, value: built.manifest };

  // 3. Draft preview through the isolated worker and the trusted composition.
  const scenes = input.scenes.map((scene) => sequence.beatIds.includes(scene.beatId)
    ? { ...scene, visual: { kind: "animationSequence" as const, sequenceId: sequence.sequenceId, manifest: built.manifestRef, description: draft.description } }
    : scene);
  const sampled = critiqueFrames(span, built.manifest.cues);
  let preview: Preview;
  try {
    log("preview", "started");
    preview = await timed(elapsedMs, "preview", () => deps.renderer.preview!(deps.renderInput(scenes), {
      profile: "draft",
      startFrame: span.startFrame,
      endFrame: span.endFrame,
      frames: sampled.map((s) => s.frame),
      signal: deps.signal,
    }));
    log("preview", "done");
  } catch (error) {
    if (!isRepairableWorkerError(error)) throw error;
    const diagnostics = error.diagnostics?.length
      ? error.diagnostics.slice(0, 12).map((d) => (d.line ? `line ${d.line}: ${d.message}` : d.message))
      : [error.message];
    log("compile", "failed", diagnostics[0]);
    return { ...base, draft, manifest, diagnostics, verdict: "revise", failedCriteria: ["compile"] };
  }

  // 4. Framed critique: the critic sees the actual candidate frames on every pass.
  const labelled = sampled.map((s) => ({ frame: s.frame, timeSec: Number((s.frame / input.fps).toFixed(2)), label: `frame ${s.frame} (${(s.frame / input.fps).toFixed(2)}s, ${beatOf(span, s.frame)}, ${s.label})` }));
  const images: PromptImage[] = [];
  for (const still of preview.frames) {
    const meta = labelled.find((l) => l.frame === still.frame)!;
    images.push({ mediaType: "image/jpeg", data: await deps.blob.get(still.blob), label: meta.label });
  }
  log("critique", "started");
  const critique = await timed(elapsedMs, "critique", () => deps.text.generate(SequenceCritique, {
    ...critiquePrompt({ input, sequence, span, manifest: built.manifest, frames: labelled, previousFindings: previous?.critique?.findings ?? [] }),
    images,
    signal: deps.signal,
    onUsage: (u) => usage.push({ ...u, step: "critique", ordinal }),
  }));
  const { verdict, failed, missing } = critiqueVerdict(critique);
  log("critique", "done", verdict);
  return {
    ...base,
    draft,
    manifest,
    preview: { id: preview.id, profile: preview.profile, startFrame: preview.startFrame, endFrame: preview.endFrame, width: preview.width, height: preview.height, video: preview.video, frames: preview.frames },
    diagnostics: [],
    critique,
    verdict,
    failedCriteria: [...failed, ...missing.map((m) => `${m} (missing)`)],
  };
}

export { CRITIQUE_CRITERIA };
