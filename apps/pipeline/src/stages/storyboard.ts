import { StoryboardDraft, newId, nowIso, type Script, type Storyboard, type VisualIntent, type Word } from "@vcp/core";
import { limits } from "@vcp/limits";
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

export const storyboard = defineStage({
  name: "storyboard",
  async input(ctx) {
    const narration = await ctx.store.latestNarration(ctx.project.id);
    if (!narration) throw new StageError("storyboard: no narration for project", false);
    return { narrationId: narration.id, scriptId: narration.scriptId };
  },
  async run(ctx, input) {
    const { ports, store, project } = ctx;
    const narration = await store.latestNarration(project.id);
    const script = await store.getScript(input.scriptId);
    if (!narration || !script) throw new StageError("storyboard: narration or script missing", false);

    const timings = beatTimings(script, narration.words);

    await limits.acquire(ports.TextModel.id);
    const draft = await ports.TextModel.generate(StoryboardDraft, {
      kind: "storyboard",
      system: "Map each beat to a visual intent. Keep the given timings. Prefer stock, then still, then clip.",
      user: script.beats.map((b) => `${b.id}: ${b.text}`).join("\n"),
      context: { beatTimings: timings, durationSec: narration.durationSec },
    });

    const board: Storyboard = {
      id: newId(),
      projectId: project.id,
      narrationId: narration.id,
      version: await store.nextStoryboardVersion(project.id),
      scenes: draft.scenes,
      containsSyntheticMedia: false,
      provider: ports.TextModel.id,
      createdAt: nowIso(),
    };
    await store.insertStoryboard(board);
    return { artifactId: board.id, summary: { version: board.version, scenes: board.scenes.length } };
  },
});
