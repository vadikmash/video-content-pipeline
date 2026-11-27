import type { SceneProp } from "./props";

export function visualTimeline(scenes: SceneProp[], fps: number, duration: number) {
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  const hasVisual = (scene: SceneProp) => scene.sequence || scene.animation || scene.diagram || scene.asset?.kind === "image" || scene.asset?.kind === "video";
  // An authored sequence is locked to its own frames, so it is never carried into other beats.
  const carriable = (scene: SceneProp) => hasVisual(scene) && !scene.sequence;
  const still = sorted.find((scene) => scene.asset?.kind === "image");
  const firstVisual = sorted.find(carriable);
  let previousVisual: SceneProp | undefined;
  const intervals = sorted.flatMap((scene, index) => {
    // The visual remains on screen through pauses and to the end of the Short.
    const start = index === 0 ? 0 : Math.max(0, Math.round(scene.start * fps));
    const next = sorted[index + 1];
    const end = next ? Math.min(duration, Math.round(next.start * fps)) : duration;
    if (end <= start) return [];
    const visual = hasVisual(scene) ? scene : (scene.beatId === "outro" ? still : undefined) ?? previousVisual ?? firstVisual ?? scene;
    if (carriable(scene)) previousVisual = scene;
    return [{ scene: visual, start, end, beatId: scene.beatId, captionPosition: scene.captionPosition ?? visual.captionPosition }];
  });
  return intervals.length ? intervals : [{
    scene: { beatId: "visual", kind: "type" as const, start: 0, end: duration / fps, text: "" },
    start: 0, end: duration, beatId: "visual", captionPosition: undefined,
  }];
}


/** Adjacent beats using the same carried scene or authored sequence share one media clock. */
export function visualSequences(timeline: ReturnType<typeof visualTimeline>) {
  const sequences: ReturnType<typeof visualTimeline> = [];
  for (const interval of timeline) {
    const previous = sequences[sequences.length - 1];
    const sameSequence = previous?.scene.sequence && previous.scene.sequence.id === interval.scene.sequence?.id;
    if (previous && (previous.scene === interval.scene || sameSequence) && previous.end === interval.start) {
      previous.end = interval.end;
    } else {
      sequences.push({ ...interval });
    }
  }
  return sequences;
}
