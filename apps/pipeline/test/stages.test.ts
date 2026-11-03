import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WORK_STAGES, approveGate, research, runStage, write } from "../src/stages/index";
import { beatTimings } from "../src/stages/storyboard";
import { hasIndependentSource } from "../src/stages/research";
import { makeWorld } from "./helpers";

/**
 * Fast pipeline test: every stage on fakes, including fake-render.
 * The real Remotion render lives in e2e.test.ts.
 */
describe("pipeline on fakes", () => {
  let world: ReturnType<typeof makeWorld>;
  afterEach(() => world?.cleanup());

  it("runs every work stage in order and ends published", async () => {
    world = makeWorld();
    const { project, store, deps } = world;

    for (const def of WORK_STAGES) {
      const out = await runStage(def, project.id, deps);
      expect(out.skipped).toBe(false);
      const stage = await store.getStage(project.id, def.name);
      expect(stage?.status).toBe("done");
      expect(stage?.inputHash).toBe(out.inputHash);
      if (def.name === "render") {
        await approveGate(project.id, "approve-video", "auto", {}, store);
      }
    }

    const render = await store.latestRender(project.id);
    expect(render).toBeDefined();
    expect(existsSync(path.join(world.dir, render!.blob.key))).toBe(true);

    const upload = await store.latestUpload(project.id);
    expect(upload?.privacy).toBe("public");
    expect(upload?.status).toBe("published");
    expect((await store.getProject(project.id))?.status).toBe("published");
    expect((await store.getIdea(project.ideaId))?.status).toBe("done");
  });

  it("is idempotent: re-running a done stage with the same input is a no-op", async () => {
    world = makeWorld();
    const { project, store, deps } = world;
    const first = await runStage(research, project.id, deps);
    const again = await runStage(research, project.id, deps);
    expect(again.skipped).toBe(true);
    expect(again.artifactId).toBe(first.artifactId);
    expect(store.briefs.length).toBe(1);
  });

  it("re-executes when the bound provider changes", async () => {
    world = makeWorld();
    const { project, store, deps } = world;
    await runStage(research, project.id, deps);
    await runStage(write, project.id, deps);
    // Swap the TextModel binding (same fake under another registration would do; here we mutate options
    // which are not part of the hash, then the provider id which is).
    world.config.ports.TextModel = { providerId: "fake-llm", options: { temperature: 0 } };
    expect((await runStage(write, project.id, deps)).skipped).toBe(true);
    world.registry.register(
      { id: "fake-llm-2", port: "TextModel", env: [], limits: {}, attributionRequired: false, costModel: { unit: "token", approxUsd: 0 }, fake: true },
      (ctx) => world.registry.instantiate("TextModel", "fake-llm", ctx.options, ctx.blob),
    );
    world.config.ports.TextModel = { providerId: "fake-llm-2", options: {} };
    const rerun = await runStage(write, project.id, deps);
    expect(rerun.skipped).toBe(false);
    expect(store.scripts.length).toBe(2);
    expect((await store.latestScript(project.id))?.version).toBe(2);
  });

  it("marks the stage failed and rethrows when a provider throws", async () => {
    world = makeWorld();
    const { project, store, deps } = world;
    world.registry.register(
      { id: "boom", port: "WebResearch", env: [], limits: {}, attributionRequired: false, costModel: { unit: "request", approxUsd: 0 }, fake: true },
      () => ({
        id: "boom",
        search: async () => {
          throw new Error("kaboom");
        },
        fetch: async () => "",
      }),
    );
    world.config.ports.WebResearch = { providerId: "boom", options: {} };
    await expect(runStage(research, project.id, deps)).rejects.toThrow("kaboom");
    const stage = await store.getStage(project.id, "research");
    expect(stage?.status).toBe("failed");
    expect(stage?.error).toContain("kaboom");
  });
});

describe("originality rule", () => {
  const idea = { ...makeWorldIdea(), opinion: false };
  it("needs a source that is not the idea's own", () => {
    expect(hasIndependentSource(idea, ["https://en.wikipedia.org/wiki/Great_Emu_War"])).toBe(false);
    expect(hasIndependentSource(idea, ["https://en.wikipedia.org/wiki/Great_Emu_War", "https://x.example/y"])).toBe(true);
  });
  it("opinion ideas skip the rule", () => {
    expect(hasIndependentSource({ ...idea, opinion: true }, [])).toBe(true);
  });
});

describe("beatTimings", () => {
  it("maps hook, beats and outro onto word timings by token count", () => {
    const script = {
      hook: "one two",
      beats: [
        { id: "b1", text: "three", visual: { kind: "type" as const } },
        { id: "b2", text: "four five six", visual: { kind: "type" as const } },
      ],
      outro: "seven",
    };
    const words = ["one", "two", "three", "four", "five", "six", "seven"].map((t, i) => ({ text: t, start: i, end: i + 1 }));
    const t = beatTimings(script as never, words);
    expect(t.map((x) => [x.beatId, x.start, x.end])).toEqual([
      ["hook", 0, 2],
      ["b1", 2, 3],
      ["b2", 3, 6],
      ["outro", 6, 7],
    ]);
  });
});

function makeWorldIdea() {
  const w = makeWorld();
  w.cleanup();
  return w.idea;
}
