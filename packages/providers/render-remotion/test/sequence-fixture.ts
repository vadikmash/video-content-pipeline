import { readFileSync } from "node:fs";
import {
  buildSequenceManifest,
  compositionDurationFrames,
  compositionDurationSec,
  sequenceSpans,
  type Scene,
} from "@vcp/core";
import type { Profile, WorkerJob } from "@vcp/animation-worker/job";
import { workerJob } from "../src/sequences";

export const fixture = JSON.parse(readFileSync(new URL("../../../../fixtures/animation/popcorn-pilot.json", import.meta.url), "utf8"));
export const FPS = fixture.fps as number;
export const PILOT = ["b3", "b4", "b5"];

export function fixtureDurationFrames(): number {
  return compositionDurationFrames(compositionDurationSec(fixture.narrationDurationSec, fixture.scenes.map((s: Scene) => s.end)), FPS);
}

/** Build the trusted manifest for the fixture and the storyboard scenes referencing it. */
export function fixtureSequence(projectId: string, source: string) {
  const ref = (manifestRef: { key: string; digest: string }) => ({
    kind: "animationSequence" as const,
    sequenceId: fixture.fixtureSequence.sequenceId as string,
    manifest: manifestRef,
    description: fixture.fixtureSequence.description as string,
  });
  const placeholder = { key: "x", digest: "0".repeat(64) };
  const scenesFor = (manifestRef: { key: string; digest: string }): Scene[] =>
    fixture.scenes.map((scene: Scene) => ({ beatId: scene.beatId, start: scene.start, end: scene.end, visual: PILOT.includes(scene.beatId) ? ref(manifestRef) : { kind: "type" } }));
  const span = sequenceSpans(scenesFor(placeholder), FPS, fixtureDurationFrames())[0]!;
  const built = buildSequenceManifest({
    projectId,
    sequenceId: fixture.fixtureSequence.sequenceId,
    description: fixture.fixtureSequence.description,
    span,
    narration: { id: fixture.provenance.narrationId, words: fixture.words },
    fps: FPS,
    cues: fixture.pilot.cues.map(({ name, word, edge, offsetFrames }: Record<string, unknown>) => ({ name, word, edge, offsetFrames })),
    poses: fixture.fixtureSequence.poses,
    style: fixture.fixtureSequence.style,
    source,
    toolkitVersion: "1.0.0",
    compilerVersion: "vcp-animation-worker:1.0.0",
    seed: fixture.fixtureSequence.seed,
  });
  const scenes = scenesFor(built.manifestRef);
  return { ...built, span: sequenceSpans(scenes, FPS, fixtureDurationFrames())[0]!, scenes };
}

export function fixtureJob(source: string, profile: Profile): WorkerJob {
  const { manifest, span } = fixtureSequence("fixture", source);
  return workerJob(manifest, source, span, profile, {});
}
