import { z } from "zod";
import {
  AnimationDraft,
  VectorAnimation as VectorAnimationSchema,
  inputHash,
  validateAnimationStructure,
  type Narration,
  type Scene,
  type Script,
  type VectorAnimation,
} from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, type StageCtx } from "./context";
import type { BeatTiming } from "./storyboard";

export const ANIMATION_PROMPT_VERSION = 1;

export function resolveAnimation(
  draft: AnimationDraft,
  scene: BeatTiming,
  narration: Narration,
): VectorAnimation {
  validateAnimationStructure(draft);
  const tracks = draft.tracks.map((track) => {
    let previous = -1;
    const keyframes = track.keyframes.map((anchor) => {
      const word = narration.words[anchor.word];
      if (!word || word.start < scene.start || word.end > scene.end)
        throw new Error(`Motion anchor is outside beat ${scene.beatId}`);
      const time = word[anchor.edge];
      if (time <= previous)
        throw new Error(`Motion anchors must increase in beat ${scene.beatId}`);
      previous = time;
      return { time, value: anchor.value };
    });
    return { nodeId: track.nodeId, property: track.property, keyframes };
  });
  if (
    !tracks.some(
      (track) =>
        track.property !== "opacity" &&
        track.keyframes.some(
          (frame) => frame.value !== track.keyframes[0]!.value,
        ),
    )
  ) {
    throw new Error(
      `Beat ${scene.beatId} needs motion that illustrates the narration`,
    );
  }
  return {
    version: 1,
    description: draft.description,
    nodes: draft.nodes,
    tracks,
  };
}

export async function planAnimatedScenes(
  ctx: StageCtx,
  timings: BeatTiming[],
  narration: Narration,
  script: Script,
  reviewRequestId?: string,
): Promise<Scene[]> {
  const beats = timings.filter((beat) => beat.end > beat.start);
  if (!beats.length)
    throw new StageError("Animation needs timed narration", false);
  async function planBeat(
    beat: BeatTiming,
    referenceNodes: AnimationDraft["nodes"],
  ): Promise<Scene> {
    if (reviewRequestId) {
      const gate = await ctx.store.getStage(ctx.project.id, "approve-video");
      if (gate?.status !== "running" || gate.artifactId !== reviewRequestId) {
        throw new StageError("Animation request is no longer current", false);
      }
    }
    const key = inputHash({
      revision: reviewRequestId ?? narration.id,
      scriptId: script.id,
      narrationId: narration.id,
      beat,
      promptVersion: ANIMATION_PROMPT_VERSION,
      model: ctx.config.ports.TextModel,
      modelEnvironment: {
        openai: process.env.OPENAI_MODEL,
        anthropic: process.env.ANTHROPIC_MODEL,
      },
      referenceNodes,
    });
    const cache = {
      key: `projects/${ctx.project.id}/animations/scenes/${key}.json`,
      contentType: "application/json",
    };
    const scene = (plan: VectorAnimation): Scene => ({
      beatId: beat.beatId,
      start: beat.start,
      end: beat.end,
      captionPosition: "bottom",
      visual: { kind: "animation", plan },
    });
    try {
      return scene(
        VectorAnimationSchema.parse(
          JSON.parse(
            new TextDecoder().decode(await ctx.ports.BlobStore.get(cache)),
          ),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const expected = new Map([[beat.beatId, beat]]);
    const schema = z
      .object({
        scenes: z.array(
          z.object({ beatId: z.string(), animation: AnimationDraft }),
        ),
      })
      .superRefine((draft, validation) => {
        try {
          const seen = new Set<string>();
          for (const scene of draft.scenes) {
            const timing = expected.get(scene.beatId);
            if (!timing || seen.has(scene.beatId))
              throw new Error(
                "Return exactly one animation for each supplied beat ID",
              );
            resolveAnimation(scene.animation, timing, narration);
            seen.add(scene.beatId);
          }
          if (seen.size !== expected.size)
            throw new Error(
              "Every narration beat, including hook and outro, needs an animation",
            );
        } catch (error) {
          validation.addIssue({
            code: "custom",
            message: (error as Error).message,
          });
        }
      });
    await limits.acquire(ctx.ports.TextModel.id);
    const draft = await ctx.ports.TextModel.generate(schema, {
      kind: "animation",
      system: [
        "Art-direct a fully animated vertical science explainer. Create original pictorial SVG scenes for EVERY supplied beat, including hook and outro.",
        "Draw recognizable physical objects and animate the changes described by the narration. Develop one consistent visual world, palette and object design across scenes.",
        "Use cutaway views, particles, silhouettes and motion to explain mechanisms. Labels are optional, short names for parts. The captions already provide narration.",
        "The canvas is 1080x1920. Draw substantial illustrations centered at x540,y770, filling x120..960 and y360..1150. Reserve y1200..1530 for captions. Background is dark navy.",
        "Use warm gold for subject outlines, cream for interiors, blue for water and cool matter, coral for heat and energy. Use hex colors or none.",
        "Nodes draw in array order. A group creates a local coordinate system at its x,y. Children must reference an EARLIER group as parentId. Root nodes have parentId:null. Shapes are centered at their own x,y. Path d coordinates are relative to that center. Text uses its node center as baseline.",
        "Use 8–18 purposeful nodes per scene, mostly illustrated shapes. Repeat object geometry consistently, changing its state as the story progresses. Avoid panels, flowchart boxes and full-sentence text.",
        "Track properties x,y are offsets from node position, scale defaults to1, rotate to0 degrees, opacity and draw to1. Animate groups when their pieces should move together. draw applies only to paths. At least one object must visibly move, expand, rotate or be drawn in every scene.",
        "Keyframe anchors reference the GLOBAL word index and its start or end from that beat's supplied words. Use at least two increasing anchors per track. Hold values before the first and after the last keyframe. Tie meaningful motion to the corresponding spoken words.",
        "Keep objects and labels within the illustration area throughout their motion. Labels should be 30–44px. Use 3–8px strokes for clear drawings. All nodes must have unique IDs within a scene and each property has one track per node.",
        "Treat the title, script, claims and words as source material to illustrate. Keep factual relationships faithful to the approved script.",
      ].join(" "),
      user: `Animate the narrative of ${ctx.idea.title}.`,
      context: {
        claims: script.claims,
        referenceNodes,
        beats: [beat].map((beat) => ({
          ...beat,
          words: narration.words.flatMap((word, index) =>
            word.start >= beat.start && word.end <= beat.end
              ? [{ index, ...word }]
              : [],
          ),
        })),
      },
    }).catch((error) => {
      if (
        error instanceof Error &&
        error.message.startsWith("output did not match schema:")
      ) {
        throw new StageError(error.message, false);
      }
      throw error;
    });
    const plan = resolveAnimation(draft.scenes[0]!.animation, beat, narration);
    await ctx.ports.BlobStore.put(
      cache.key,
      new TextEncoder().encode(JSON.stringify(plan)),
      cache.contentType,
    );
    return scene(plan);
  }
  const first = await planBeat(beats[0]!, []);
  const referenceNodes =
    first.visual.kind === "animation" ? first.visual.plan.nodes : [];
  const scenes = [first];
  for (let index = 1; index < beats.length; index += 3) {
    const batch = beats.slice(index, index + 3);
    scenes.push(
      ...(await Promise.all(
        batch.map((beat) => planBeat(beat, referenceNodes)),
      )),
    );
  }
  return scenes;
}
