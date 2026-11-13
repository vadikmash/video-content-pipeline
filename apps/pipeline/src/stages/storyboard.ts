import { newId, nowIso, type Script, type Storyboard, type VisualIntent, type Word } from "@vcp/core";
import { StageError, defineStage } from "./context";

export interface BeatTiming {
  beatId: string;
  text: string;
  start: number;
  end: number;
  visual: VisualIntent;
}

const tokenize = (s: string) => s.split(/\s+/).filter(Boolean);

/**
 * Map hook, beats and outro onto the narration's word timings by counting
 * tokens with the same tokenizer Speech received the text with.
 */
export function beatTimings(script: Script, words: Word[]): BeatTiming[] {
  const segments: { beatId: string; text: string; visual: VisualIntent }[] = [
    { beatId: "hook", text: script.hook, visual: { kind: "type" } },
    ...script.beats.map((b) => ({ beatId: b.id, text: b.text, visual: b.visual })),
    { beatId: "outro", text: script.outro, visual: { kind: "type" } },
  ];
  const out: BeatTiming[] = [];
  let cursor = 0;
  const lastEnd = words.length ? words[words.length - 1]!.end : 0;
  for (const seg of segments) {
    const n = tokenize(seg.text).length;
    const first = words[cursor];
    const last = words[Math.min(words.length - 1, cursor + n - 1)];
    const start = first?.start ?? lastEnd;
    const end = n ? (last?.end ?? lastEnd) : start;
    out.push({ ...seg, start, end: Math.max(end, start) });
    cursor += n;
  }
  return out;
}

/**
 * Template v1 is kinetic type only. The LLM storyboard planner (stock, stills, clips) is M2.
 */
export const storyboard = defineStage({
  name: "storyboard",
  async input(ctx) {
    const narration = await ctx.store.latestNarration(ctx.project.id);
    if (!narration) throw new StageError("storyboard: no narration for project", false);
    return { narrationId: narration.id, scriptId: narration.scriptId };
  },
  async run(ctx, input) {
    const { store, project } = ctx;
    const narration = await store.latestNarration(project.id);
    const script = await store.getScript(input.scriptId);
    if (!narration || !script) throw new StageError("storyboard: narration or script missing", false);

    const timings = beatTimings(script, narration.words);
    const board: Storyboard = {
      id: newId(),
      projectId: project.id,
      narrationId: narration.id,
      version: await store.nextStoryboardVersion(project.id),
      scenes: timings.map((t) => ({
        beatId: t.beatId,
        start: t.start,
        end: t.end,
        visual: { kind: "type" as const },
      })),
      containsSyntheticMedia: false,
      provider: "template-v1",
      createdAt: nowIso(),
    };
    await store.insertStoryboard(board);
    return { artifactId: board.id, summary: { version: board.version, scenes: board.scenes.length, visuals: "type" } };
  },
});
