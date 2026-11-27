import { describe, expect, it } from "vitest";
import type { SceneProp } from "./props";
import { visualTimeline, visualSequences } from "./visual-timeline";

it("keeps caption overrides per beat while carried footage plays continuously", () => {
  const footage: SceneProp = {beatId:"footage",start:0,end:2,text:"",kind:"stock",captionPosition:"bottom",
    asset:{kind:"video",url:"https://example.test/clip.mp4",durationSec:10}};
  const caption: SceneProp = {beatId:"explanation",start:2,end:4,text:"",kind:"type",captionPosition:"top"};
  const timeline = visualTimeline([footage, caption],30,120);
  expect(timeline[1]?.captionPosition).toBe("top");
  expect(timeline[1]?.scene).toBe(footage);
  const sequences = visualSequences(timeline);
  expect(sequences).toHaveLength(1);
  expect(sequences[0]).toMatchObject({start:0,end:120,scene:footage});
  expect(timeline[0]?.end).toBe(60);
});

it("starts the first available visual at the beginning and preserves its clock at its authored beat", () => {
  const hook: SceneProp = {beatId:"hook",start:0,end:3,text:"",kind:"type"};
  const image: SceneProp = {beatId:"image",start:3,end:5,text:"",kind:"still",captionPosition:"top",
    asset:{kind:"image",url:"https://example.test/image.png"}};
  const intervals=visualTimeline([hook,image],30,150);
  expect(intervals[0]?.scene).toBe(image);
  expect(visualSequences(intervals)).toHaveLength(1);
});

describe("authored sequences", () => {
  const seq = { id: "popcorn", url: "http://x/visual.mov", startFrame: 384, endFrame: 716 };
  const scene = (beatId: string, start: number, end: number, sequence?: typeof seq) =>
    ({ beatId, start, end, text: "", kind: sequence ? "animationSequence" as const : "type" as const, sequence });
  it("collapses adjacent beats of one sequence into one media clock and keeps beat intervals", () => {
    const scenes = [scene("b2", 8.973, 12.566), scene("b3", 12.804, 15.649, seq), scene("b4", 15.916, 18.962, seq), scene("b5", 19.137, 23.681, seq), scene("b6", 23.866, 28.1)];
    const timeline = visualTimeline(scenes, 30, 900);
    expect(timeline.filter((i) => i.scene.sequence).map((i) => [i.beatId, i.start, i.end])).toEqual([["b3", 384, 477], ["b4", 477, 574], ["b5", 574, 716]]);
    const merged = visualSequences(timeline).filter((s) => s.scene.sequence);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ start: 384, end: 716 });
    // Beats outside the sequence never carry its time-locked clip.
    expect(timeline.find((i) => i.beatId === "b2")!.scene.sequence).toBeUndefined();
    expect(timeline.find((i) => i.beatId === "b6")!.scene.sequence).toBeUndefined();
  });
});
