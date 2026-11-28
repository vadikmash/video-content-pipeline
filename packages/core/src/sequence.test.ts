import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertCueOrder,
  beatFrameIntervals,
  boxesOverlap,
  captionBox,
  compositionDurationFrames,
  compositionDurationSec,
  poseBounds,
  resolveCues,
  sequenceSpans,
} from "./animation";
import { SceneVisual, VisualIntent } from "./schemas";
import { buildSequenceManifest, verifySequenceManifest } from "./sequence";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/animation/popcorn-pilot.json", import.meta.url), "utf8"));
const FPS = fixture.fps as number;
const words = fixture.words as { text: string; start: number; end: number }[];
const durationFrames = compositionDurationFrames(compositionDurationSec(fixture.narrationDurationSec, fixture.scenes.map((s: { end: number }) => s.end)), FPS);
const ref = (sequenceId: string, digest = "a".repeat(64)) => ({
  kind: "animationSequence" as const,
  sequenceId,
  manifest: { key: `projects/p1/animations/manifests/${sequenceId}/${digest}.json`, digest },
  description: "test",
});
const scenesWith = (visualFor: (beatId: string) => { kind: string }) =>
  (fixture.scenes as { beatId: string; start: number; end: number }[]).map((scene) => ({ ...scene, visual: visualFor(scene.beatId) }));
const pilotScenes = scenesWith((beat) => (["b3", "b4", "b5"].includes(beat) ? ref("popcorn") : { kind: "type" }));
const LAYOUT = { fontSize: 64, top: 0.24, bottom: 0.68 };

describe("sequence frames", () => {
  it("derives the popcorn pilot bounds and the composition length from the saved revision", () => {
    expect(durationFrames).toBe(Math.round(39.1 * FPS));
    const [span] = sequenceSpans(pilotScenes, FPS, durationFrames);
    expect(span).toMatchObject({ sequenceId: "popcorn", beatIds: ["b3", "b4", "b5"], startFrame: 384, endFrame: 716 });
    expect(span!.beats.map((b) => [b.beatId, b.start, b.end])).toEqual([["b3", 384, 477], ["b4", 477, 574], ["b5", 574, 716]]);
    expect({ start: span!.startFrame, end: span!.endFrame }).toEqual({ start: fixture.pilot.startFrame, end: fixture.pilot.endFrame });
  });

  it("starts the first sequence at frame zero and holds the last through the audio tail", () => {
    const whole = sequenceSpans(scenesWith(() => ref("all")), FPS, durationFrames);
    expect(whole).toHaveLength(1);
    expect(whole[0]).toMatchObject({ startFrame: 0, endFrame: durationFrames });
    expect(whole[0]!.beatIds).toHaveLength(9);
    const intervals = beatFrameIntervals(pilotScenes, FPS, durationFrames);
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]!.start).toBe(intervals[i - 1]!.end);
  });

  it("rounds each word edge to a frame before subtracting the sequence start", () => {
    const cues = resolveCues(fixture.pilot.cues, words, FPS, { startFrame: 384, endFrame: 716 });
    expect(cues.map((c) => [c.name, c.frame, c.localFrame])).toEqual([
      ["heats", 405, 21], ["vapor", 459, 75], ["builds", 525, 141], ["pressure", 534, 150], ["ruptures", 607, 223], ["expands", 662, 278],
    ]);
    expect(cues.map((c) => c.frame)).toEqual(fixture.pilot.cues.map((c: { frame: number }) => c.frame));
    assertCueOrder(cues, ["heats", "vapor", "builds", "pressure", "ruptures", "expands"], true);
  });

  it("applies bounded offsets, rejects cues outside the span and checks order", () => {
    const span = { startFrame: 384, endFrame: 716 };
    expect(resolveCues([{ name: "windup", word: 59, edge: "start", offsetFrames: -6 }], words, FPS, span)[0]!.frame).toBe(601);
    expect(() => resolveCues([{ name: "late", word: 70, edge: "start", offsetFrames: 0 }], words, FPS, span)).toThrow(/outside sequence/);
    expect(() => resolveCues([{ name: "far", word: 59, edge: "start", offsetFrames: 31 }], words, FPS, span)).toThrow();
    expect(() => resolveCues([{ name: "x", word: 40, edge: "start", offsetFrames: 0 }, { name: "x", word: 41, edge: "start", offsetFrames: 0 }], words, FPS, span)).toThrow(/Duplicate/);
    // Two anchors quantized to the same frame pass the default order check but not the strict one.
    const same = resolveCues([{ name: "a", word: 58, edge: "end", offsetFrames: 2 }, { name: "b", word: 59, edge: "start", offsetFrames: 0 }], words, FPS, span);
    expect(same[0]!.frame).toBe(607);
    expect(same[0]!.frame).toBe(same[1]!.frame);
    expect(() => assertCueOrder(same, ["a", "b"])).not.toThrow();
    expect(() => assertCueOrder(same, ["a", "b"], true)).toThrow(/must follow/);
    expect(() => assertCueOrder(resolveCues(fixture.pilot.cues, words, FPS, span), ["expands", "ruptures"])).toThrow(/must follow/);
  });

  it("rejects noncontiguous reuse, split manifests and duplicate beats", () => {
    const gap = scenesWith((beat) => (beat === "b3" || beat === "b5" ? ref("s") : { kind: "type" }));
    expect(() => sequenceSpans(gap, FPS, durationFrames)).toThrow(/noncontiguous/);
    const twoManifests = scenesWith((beat) => (beat === "b3" ? ref("s", "a".repeat(64)) : beat === "b4" ? ref("s", "b".repeat(64)) : { kind: "type" }));
    expect(() => sequenceSpans(twoManifests, FPS, durationFrames)).toThrow(/two manifests/);
    const duplicate = [...pilotScenes, { ...pilotScenes[4]! }];
    expect(() => sequenceSpans(duplicate, FPS, durationFrames)).toThrow(/appears twice/);
    // Adjacent, different sequences are fine.
    const two = scenesWith((beat) => (beat === "b3" ? ref("one") : beat === "b4" ? ref("two") : { kind: "type" }));
    expect(sequenceSpans(two, FPS, durationFrames).map((s) => [s.sequenceId, s.startFrame, s.endFrame])).toEqual([["one", 384, 477], ["two", 477, 574]]);
  });

  it("keeps generated sequence refs out of the planner schema", () => {
    expect(SceneVisual.safeParse(ref("s")).success).toBe(true);
    expect(VisualIntent.safeParse(ref("s")).success).toBe(false);
  });
});

describe("sequence manifest", () => {
  const source = readFileSync(new URL("../../../fixtures/animation/popcorn-kernel.tsx", import.meta.url), "utf8");
  const [span] = sequenceSpans(pilotScenes, FPS, durationFrames);
  const narration = { id: fixture.provenance.narrationId as string, words };
  const build = () => buildSequenceManifest({
    projectId: "p1",
    sequenceId: "popcorn",
    description: fixture.fixtureSequence.description,
    span: span!,
    narration,
    fps: FPS,
    cues: fixture.pilot.cues,
    poses: fixture.fixtureSequence.poses,
    style: fixture.fixtureSequence.style,
    source,
    toolkitVersion: "1.0.0",
    compilerVersion: "vcp-animation-worker:1.0.0",
    seed: fixture.fixtureSequence.seed,
  });

  it("assigns project-scoped keys and digests in trusted code", () => {
    const built = build();
    expect(built.manifest.source.key).toMatch(/^projects\/p1\/animations\/sources\/popcorn\/[0-9a-f]{64}\.tsx$/);
    expect(built.manifestRef.key).toBe(`projects/p1/animations/manifests/popcorn/${built.manifestRef.digest}.json`);
    expect(build().manifestRef.digest).toBe(built.manifestRef.digest);
    expect(built.manifest.cues.find((c) => c.name === "ruptures")).toMatchObject({ frame: 607, localFrame: 223 });
  });

  it("detects drift between the manifest, storyboard and narration", () => {
    const { manifest } = build();
    const context = { projectId: "p1", span: span!, narration, fps: FPS };
    expect(() => verifySequenceManifest(manifest, context)).not.toThrow();
    expect(() => verifySequenceManifest(manifest, { ...context, projectId: "p2" })).toThrow(/another project/);
    const retimed = words.map((w, i) => (i === 59 ? { ...w, start: w.start + 0.2 } : w));
    expect(() => verifySequenceManifest(manifest, { ...context, narration: { ...narration, words: retimed } })).toThrow(/timing changed/);
    const moved = sequenceSpans(scenesWith((beat) => (["b4", "b5"].includes(beat) ? ref("popcorn") : { kind: "type" })), FPS, durationFrames)[0]!;
    expect(() => verifySequenceManifest(manifest, { ...context, span: moved })).toThrow(/covers beats/);
  });

  it("keeps the fixture's key geometry clear of the caption box at both ends", () => {
    const caption = captionBox("bottom", LAYOUT);
    for (const poses of [fixture.fixtureSequence.poses.start, fixture.fixtureSequence.poses.end]) {
      for (const pose of Object.values(poses) as Parameters<typeof poseBounds>[0][]) {
        expect(boxesOverlap(poseBounds(pose), caption)).toBe(false);
      }
    }
    // A pose pushed into the caption band is caught.
    expect(boxesOverlap(poseBounds({ x: 540, y: 1250, width: 400, height: 300, scale: 1, rotate: 0 }), caption)).toBe(true);
  });
});
