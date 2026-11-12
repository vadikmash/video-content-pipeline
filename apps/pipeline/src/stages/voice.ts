import { newId, nowIso, scriptText, type Narration } from "@vcp/core";
import { limits } from "@vcp/limits";
import { DEFAULT_TIGHTEN, tightenPauses } from "../audio/pauses";
import { StageError, defineStage, voiceOptions, type StageCtx } from "./context";

const EXT: Record<string, string> = { "audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac" };

export const voice = defineStage({
  name: "voice",
  async input(ctx) {
    const script = await ctx.store.latestScript(ctx.project.id);
    if (!script) throw new StageError("voice: no script for project", false);
    return { scriptId: script.id, text: scriptText(script), voice: voiceOptions(ctx.config) };
  },
  async run(ctx, input) {
    const { ports, store, project } = ctx;

    await limits.acquire(ports.Speech.id, { cost: input.text.length });
    const synth = await ports.Speech.synthesize(input.text, input.voice);

    let words = synth.words;
    let alignerProvider: string | undefined;
    if (!words || !words.length) {
      await limits.acquire(ports.Aligner.id);
      words = await ports.Aligner.align(synth.audio, input.text);
      alignerProvider = ports.Aligner.id;
    }

    // Shorten long pauses. Fake TTS is silence, so there is nothing to tighten there.
    let audio = synth.audio;
    let contentType = synth.contentType;
    let tightened = { removedSec: 0, pauses: 0 };
    const maxPauseSec = pauseLimit(input.voice.options);
    if (maxPauseSec !== null && !speechIsFake(ctx)) {
      const out = await tightenPauses(audio, words, { ...DEFAULT_TIGHTEN, maxPauseSec });
      audio = out.audio;
      contentType = out.contentType ?? contentType;
      words = out.words;
      tightened = { removedSec: out.removedSec, pauses: out.pauses };
    }

    const id = newId();
    const ext = EXT[contentType] ?? "bin";
    const audioBlob = await ports.BlobStore.put(`projects/${project.id}/narration/${id}.${ext}`, audio, contentType);
    const durationSec = words.length ? words[words.length - 1]!.end : 0;

    const narration: Narration = {
      id,
      projectId: project.id,
      scriptId: input.scriptId,
      audioBlob,
      words,
      voiceId: input.voice.voiceId,
      provider: ports.Speech.id,
      alignerProvider,
      durationSec,
      createdAt: nowIso(),
    };
    await store.insertNarration(narration);
    return {
      artifactId: id,
      summary: {
        durationSec,
        words: words.length,
        aligner: alignerProvider ?? "from-speech",
        pausesShortened: tightened.pauses,
        pauseSecRemoved: tightened.removedSec,
      },
    };
  },
});

/** Speech options.maxPauseSec: a number of seconds, or false to keep pauses as synthesized. */
function pauseLimit(options: Record<string, unknown> | undefined): number | null {
  const v = options?.maxPauseSec;
  if (v === false) return null;
  return typeof v === "number" && v > 0 ? v : DEFAULT_TIGHTEN.maxPauseSec;
}

function speechIsFake(ctx: StageCtx): boolean {
  const id = ctx.ports.Speech.id;
  return ctx.registry.manifests().some((m) => m.id === id && m.fake === true);
}
