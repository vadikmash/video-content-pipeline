import { expect, it } from "vitest";
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
