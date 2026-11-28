import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ZodType } from "zod";
import { describe, expect, it } from "vitest";
import {
  compositionDurationFrames,
  compositionDurationSec,
  type Prompt,
  type RenderInput,
  type Renderer,
  type Scene,
  type SequenceAuthorDraft,
  type SequenceCritique,
  type SequenceDirection,
  type TextModel,
} from "@vcp/core";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import { create as createFakeRenderer } from "@vcp/provider-fake-render";
import {
  authorSequence,
  critiqueFrames,
  directSequences,
  plannedSpan,
  type SequenceAuthoringDeps,
  type SequenceAuthoringInput,
} from "../src/animation/sequence-author";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/animation/popcorn-pilot.json", import.meta.url), "utf8"));
const kernel = readFileSync(new URL("../../../fixtures/animation/popcorn-kernel.tsx", import.meta.url), "utf8");
const FPS = 30;
const scenes: Scene[] = fixture.scenes.map((s: Scene) => ({ beatId: s.beatId, start: s.start, end: s.end, visual: { kind: "type" } }));
const durationFrames = compositionDurationFrames(compositionDurationSec(fixture.narrationDurationSec, scenes.map((s) => s.end)), FPS);

function input(attemptId = "trial-1"): SequenceAuthoringInput {
  return {
    projectId: "p1",
    attemptId,
    title: "Popcorn",
    script: fixture.script,
    narration: { id: fixture.provenance.narrationId, words: fixture.words, durationSec: fixture.narrationDurationSec },
    scenes,
    fps: FPS,
    durationFrames,
    seed: 1729,
  };
}

const direction: SequenceDirection = {
  styleNotes: "Warm hull, pale starch, cool moisture; light from the upper left.",
  palette: [{ name: "background", hex: "#14202b" }, { name: "hull", hex: "#c8742c" }],
  mechanismSequenceId: "kernel-pop",
  sequences: [
    { sequenceId: "intro", beatIds: ["hook", "b1", "b2"], mechanism: "m", objects: [], framing: "f", transitionIn: "open", keyCues: [] },
    { sequenceId: "kernel-pop", beatIds: ["b3", "b4", "b5"], mechanism: "heat, pressure, rupture", objects: [{ id: "hull", role: "shell" }], framing: "close", transitionIn: "continuous", keyCues: ["heats", "ruptures"] },
    { sequenceId: "rest", beatIds: fixture.scenes.map((s: Scene) => s.beatId).slice(6), mechanism: "m", objects: [], framing: "f", transitionIn: "cut", keyCues: [] },
  ],
};

const pose = { id: "hull", x: 290, y: 430, width: 500, height: 660, scale: 1, rotate: 0 };
function draft(overrides: Partial<SequenceAuthorDraft> = {}): SequenceAuthorDraft {
  return {
    description: "A kernel heats, builds pressure and ruptures.",
    cues: fixture.pilot.cues.map(({ name, word, edge }: { name: string; word: number; edge: "start" | "end" }) => ({ name, word, edge, offsetFrames: 0 })),
    poses: { start: [pose], end: [pose] },
    source: kernel,
    revisionNotes: "",
    ...overrides,
  };
}
function critique(verdict: "pass" | "revise"): SequenceCritique {
  return {
    summary: verdict,
    findings: ["mechanism", "art", "continuity", "motion", "delivery"].map((criterion) => ({
      criterion: criterion as SequenceCritique["findings"][number]["criterion"],
      frame: 607,
      observed: `${criterion} observed`,
      change: verdict === "revise" && criterion === "motion" ? "make the rupture faster" : "",
      verdict: verdict === "revise" && criterion === "motion" ? "revise" : "pass",
    })),
  };
}

/** Scripted model: returns queued outputs by step and records every prompt. */
function scripted(queue: Record<string, unknown[]>, images = true) {
  const calls: Prompt[] = [];
  const model: TextModel = {
    id: "scripted",
    capabilities: { images, model: "scripted-1" },
    async generate<T>(schema: ZodType<T>, prompt: Prompt) {
      calls.push(prompt);
      const step = String(prompt.context?.step);
      const next = queue[step]?.shift();
      if (next === undefined) throw new Error(`No scripted output for ${step}`);
      if (next instanceof Error) throw next;
      prompt.onUsage?.({ provider: "scripted", model: "scripted-1", repair: 0, inputTokens: 10, outputTokens: 5 });
      return schema.parse(next);
    },
  };
  return { model, calls };
}

function deps(text: TextModel, renderer?: Renderer) {
  const blob = createLocalBlobStore({ dir: mkdtempSync(path.join(os.tmpdir(), "vcp-seq-author-")) });
  const fake = renderer ?? createFakeRenderer({ env: {}, options: {}, blob });
  const previews: { startFrame: number; endFrame: number; frames?: number[]; scenes: Scene[] }[] = [];
  const wrapped: Renderer = {
    id: fake.id,
    render: fake.render,
    async preview(renderInput, options) {
      previews.push({ ...options, scenes: renderInput.storyboard.scenes });
      return fake.preview!(renderInput, options);
    },
  };
  const d: SequenceAuthoringDeps = {
    text,
    blob,
    renderer: wrapped,
    renderInput: (s) => ({ projectId: "p1", storyboard: { scenes: s } } as unknown as RenderInput),
  };
  return { deps: d, blob, previews };
}

describe("sequence direction", () => {
  it("requires every timed beat once, in order", async () => {
    const missing = { ...direction, sequences: direction.sequences.slice(0, 2) };
    const { model } = scripted({ direction: [missing] });
    await expect(directSequences(deps(model).deps, input())).rejects.toThrow(/cover beats/);
  });

  it("checkpoints the direction and reuses it for the same inputs", async () => {
    const { model, calls } = scripted({ direction: [direction] });
    const { deps: d } = deps(model);
    const first = await directSequences(d, input());
    const again = await directSequences(d, input());
    expect(first.cached).toBe(false);
    expect(again.cached).toBe(true);
    expect(again.direction).toEqual(direction);
    expect(calls).toHaveLength(1);
    expect(first.usage[0]).toMatchObject({ step: "direction", inputTokens: 10 });
  });
});

describe("sequence authoring loop", () => {
  it("plans the pilot on frames 384-716", () => {
    const span = plannedSpan(input(), direction.sequences[1]!);
    expect([span.startFrame, span.endFrame, span.beatIds]).toEqual([384, 716, ["b3", "b4", "b5"]]);
  });

  it("samples cue onsets, follow-through and beat boundaries within bounds", () => {
    const span = plannedSpan(input(), direction.sequences[1]!);
    const frames = critiqueFrames(span, fixture.pilot.cues);
    expect(frames.length).toBeLessThanOrEqual(18);
    const list = frames.map((f) => f.frame);
    expect(list).toEqual([...list].sort((a, b) => a - b));
    for (const frame of [384, 715, 405, 607, 662, 476, 477, 573, 574]) expect(list).toContain(frame);
    expect(frames.find((f) => f.frame === 607)?.label).toContain("cue ruptures");
  });

  it("revises on critique findings, shows the critic frames, and accepts", async () => {
    const { model, calls } = scripted({ author: [draft(), draft({ revisionNotes: "faster rupture" })], critique: [critique("revise"), critique("pass")] });
    const { deps: d, previews } = deps(model);
    const outcome = await authorSequence(d, input(), direction);
    expect(outcome.status).toBe("accepted");
    if (outcome.status !== "accepted") return;
    expect(outcome.attempts.map((a) => a.verdict)).toEqual(["revise", "pass"]);
    // The revision prompt carries the previous source and the finding to fix.
    const revisionPrompt = calls.filter((c) => c.context?.step === "author")[1]!;
    expect(revisionPrompt.user).toContain("make the rupture faster");
    expect(revisionPrompt.user).toContain("Previous source");
    // Each critique sees real image attachments for the sampled frames.
    const critiques = calls.filter((c) => c.context?.step === "critique");
    expect(critiques).toHaveLength(2);
    expect(critiques[0]!.images!.length).toBe(previews[0]!.frames!.length);
    expect(critiques[0]!.images![0]!.label).toMatch(/^frame 384 \(12\.80s, b3/);
    // Previews are draft excerpts of exactly the sequence span.
    expect(previews.map((p) => [p.startFrame, p.endFrame])).toEqual([[384, 716], [384, 716]]);
    expect(outcome.scenes.filter((s) => s.visual.kind === "animationSequence").map((s) => s.beatId)).toEqual(["b3", "b4", "b5"]);
    expect(outcome.checkpoint.usage.map((u) => u.step)).toEqual(["author", "critique"]);
  });

  it("reuses checkpoints on a retry of the same attempt without paid calls", async () => {
    const { model, calls } = scripted({ author: [draft()], critique: [critique("pass")] });
    const { deps: d } = deps(model);
    await authorSequence(d, input(), direction);
    const before = calls.length;
    const again = await authorSequence(d, input(), direction);
    expect(again.status).toBe("accepted");
    expect(calls.length).toBe(before);
  });

  it("feeds validation errors back and counts them against the budget", async () => {
    const bad = draft({ cues: [{ name: "late", word: 100, edge: "start", offsetFrames: 0 }] });
    const { model, calls } = scripted({ author: [bad, draft()], critique: [critique("pass")] });
    const outcome = await authorSequence(deps(model).deps, input(), direction);
    expect(outcome.status).toBe("accepted");
    expect(outcome.attempts[0]).toMatchObject({ verdict: "revise", failedCriteria: ["compile"] });
    expect(outcome.attempts[0]!.diagnostics[0]).toMatch(/outside sequence frames/);
    expect(calls.filter((c) => c.context?.step === "author")[1]!.user).toMatch(/diagnostics[\s\S]*outside sequence frames/);
  });

  it("treats repairable worker errors as source feedback and rethrows infrastructure errors", async () => {
    const workerError = (repairable: boolean) => Object.assign(new Error("Sequence typecheck failed"), {
      name: "SequenceWorkerError", repairable, diagnostics: [{ line: 3, message: "Type 'string' is not assignable" }],
    });
    const failing = (error: Error): Renderer => ({ id: "failing", render: async () => { throw error; }, preview: async () => { throw error; } });

    const repair = scripted({ author: [draft(), draft()], critique: [critique("pass")] });
    let fake: Renderer | undefined;
    let first = true;
    const flaky: Renderer = {
      id: "flaky",
      render: async () => { throw new Error("unused"); },
      async preview(renderInput, options) {
        if (first) { first = false; throw workerError(true); }
        return fake!.preview!(renderInput, options);
      },
    };
    const d = deps(repair.model, flaky).deps;
    fake = createFakeRenderer({ env: {}, options: {}, blob: d.blob });
    const outcome = await authorSequence(d, input(), direction);
    expect(outcome.status).toBe("accepted");
    expect(outcome.attempts[0]).toMatchObject({ failedCriteria: ["compile"], diagnostics: ["line 3: Type 'string' is not assignable"] });
    expect(repair.calls.filter((c) => c.context?.step === "author")[1]!.user).toContain("line 3: Type 'string' is not assignable");

    const infra = scripted({ author: [draft()] });
    await expect(authorSequence(deps(infra.model, failing(workerError(false))).deps, input(), direction)).rejects.toThrow(/typecheck failed/);
  });

  it("ends after two revisions without promoting a rejected draft", async () => {
    const { model } = scripted({ author: [draft(), draft(), draft()], critique: [critique("revise"), critique("revise"), critique("revise")] });
    const outcome = await authorSequence(deps(model).deps, input(), direction);
    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") return;
    expect(outcome.attempts).toHaveLength(3);
    expect(outcome.failedCriteria).toEqual(["motion"]);
  });

  it("refuses to start paid authoring when the model cannot see images", async () => {
    const { model, calls } = scripted({ author: [draft()] }, false);
    await expect(authorSequence(deps(model).deps, input(), direction)).rejects.toThrow(/does not accept image input/);
    expect(calls).toHaveLength(0);
  });
});
