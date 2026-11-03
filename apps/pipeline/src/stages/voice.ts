import { newId, nowIso, scriptText, type Narration } from "@vcp/core";
import { limits } from "@vcp/limits";
import { StageError, defineStage, voiceOptions } from "./context";

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

    const id = newId();
    const ext = EXT[synth.contentType] ?? "bin";
    const audioBlob = await ports.BlobStore.put(`projects/${project.id}/narration/${id}.${ext}`, synth.audio, synth.contentType);
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
    return { artifactId: id, summary: { durationSec, words: words.length, aligner: alignerProvider ?? "from-speech" } };
  },
});
