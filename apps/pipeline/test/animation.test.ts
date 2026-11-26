import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AnimationDraft } from "@vcp/core";
import { WORK_STAGES, runStage, storyboard } from "../src/stages/index";
import { planAnimatedScenes, resolveAnimation } from "../src/stages/animation";
import { loadStageCtx } from "../src/stages/context";
import { beatTimings } from "../src/stages/storyboard";
import { makeWorld } from "./helpers";

describe("fully animated production", () => {
  let world: ReturnType<typeof makeWorld>;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(() => world.cleanup());

  it("persists vector scenes for every beat and obtains zero media assets", async () => {
    await world.store.updateProject(world.project.id, {
      visualMode: "animated",
    });
    for (const stage of WORK_STAGES.slice(0, 5))
      await runStage(stage, world.project.id, world.deps);
    const board = await world.store.latestStoryboard(world.project.id);
    expect(
      board!.scenes.every((scene) => scene.visual.kind === "animation"),
    ).toBe(true);
    expect(board!.scenes[0]!.beatId).toBe("hook");
    expect(board!.scenes.at(-1)!.beatId).toBe("outro");
    expect(world.store.assets.size).toBe(0);
    expect(
      (await runStage(storyboard, world.project.id, world.deps)).skipped,
    ).toBe(true);
  });
  it("reuses saved scene plans and stops an obsolete review request before model calls", async () => {
    await world.store.updateProject(world.project.id, {
      visualMode: "animated",
    });
    for (const stage of WORK_STAGES.slice(0, 4))
      await runStage(stage, world.project.id, world.deps);
    const narration = (await world.store.latestNarration(world.project.id))!;
    const script = (await world.store.latestScript(world.project.id))!;
    const ctx = await loadStageCtx(
      world.project.id,
      world.store,
      world.registry,
    );
    const generate = vi.spyOn(ctx.ports.TextModel, "generate");
    const timings = beatTimings(script, narration.words);
    await planAnimatedScenes(ctx, timings, narration, script);
    expect(generate).not.toHaveBeenCalled();
    await expect(
      planAnimatedScenes(ctx, timings, narration, script, "obsolete-request"),
    ).rejects.toMatchObject({ retriable: false });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("narration anchored motion", () => {
  const node = {
    id: "water",
    parentId: null,
    x: 500,
    y: 700,
    fill: "#63c6ff",
    stroke: "none",
    strokeWidth: 0,
    shape: { kind: "ellipse" as const, rx: 40, ry: 60 },
  };
  const draft: AnimationDraft = {
    description: "Water rises into steam",
    nodes: [node, { ...node, id: "hull" }],
    tracks: [
      {
        nodeId: "water",
        property: "y",
        keyframes: [
          { word: 1, edge: "start", value: 0 },
          { word: 2, edge: "end", value: -150 },
        ],
      },
    ],
  };
  const scene = {
    beatId: "b1",
    start: 1,
    end: 3,
    text: "Water vaporizes",
    visual: { kind: "type" as const },
  };
  const narration = {
    words: [
      { text: "intro", start: 0, end: 0.8 },
      { text: "Water", start: 1, end: 1.8 },
      { text: "vaporizes", start: 2, end: 3 },
    ],
  };

  it("resolves global word anchors and rejects cues from a different beat", () => {
    const full = narration as Parameters<typeof resolveAnimation>[2];
    expect(resolveAnimation(draft, scene, full).tracks[0]!.keyframes).toEqual([
      { time: 1, value: 0 },
      { time: 3, value: -150 },
    ]);
    const invalid = structuredClone(draft);
    invalid.tracks[0]!.keyframes[0]!.word = 0;
    expect(() => resolveAnimation(invalid, scene, full)).toThrow(
      "outside beat",
    );
  });

  it("rejects dangling groups and duplicate property tracks", () => {
    const invalid = structuredClone(draft);
    invalid.nodes[0]!.parentId = "missing";
    expect(() =>
      resolveAnimation(
        invalid,
        scene,
        narration as Parameters<typeof resolveAnimation>[2],
      ),
    ).toThrow("earlier group");
    invalid.nodes[0]!.parentId = null;
    invalid.tracks.push(invalid.tracks[0]!);
    expect(() =>
      resolveAnimation(
        invalid,
        scene,
        narration as Parameters<typeof resolveAnimation>[2],
      ),
    ).toThrow("duplicate motion track");
  });
});
