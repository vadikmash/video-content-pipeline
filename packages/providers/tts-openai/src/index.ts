import { defineManifest, inputHash, ProviderError, type Aligner, type ProviderContext, type Speech } from "@vcp/core";
import { wordsFromAlignment } from "@vcp/provider-tts-elevenlabs";
import { z } from "zod";

export const manifest = defineManifest({
  id: "tts-openai",
  port: "Speech",
  env: ["OPENAI_API_KEY"],
  limits: { concurrency: 2 },
  attributionRequired: false,
  costModel: { unit: "character", approxUsd: 0 },
  description: "OpenAI conversational narration, default Marin, with Whisper word timestamps. OPENAI_TTS_VOICE and OPENAI_TTS_MODEL select the voice and model.",
});

export const alignManifest = defineManifest({
  ...manifest, id: "align-openai", port: "Aligner",
  description: "Whisper word timestamps matched back to the original script.",
});

export const DEFAULT_INSTRUCTIONS = "Tell this science story with lively curiosity, as if sharing a surprising discovery with a friend. Use a warm, bright conversational voice, expressive but believable intonation, and crisp articulation. Give the opening question an inviting lift, stress the surprising details, and let the final explanation land with satisfaction. Keep a flowing, upbeat pace with short natural pauses between ideas.";

const transcriptionSchema = z.object({
  words: z.array(z.object({
    word: z.string().min(1), start: z.number().nonnegative(), end: z.number().nonnegative(),
  }).refine((word) => word.end >= word.start)).min(1),
});

async function request(ctx: ProviderContext, endpoint: string, body: BodyInit, json = false): Promise<Response> {
  if (!ctx.env.OPENAI_API_KEY) throw new ProviderError("OpenAI narration needs OPENAI_API_KEY", 401);
  const response = await fetch(`https://api.openai.com/v1/audio/${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${ctx.env.OPENAI_API_KEY}`, ...(json ? { "content-type": "application/json" } : {}) },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new ProviderError(`OpenAI audio HTTP ${response.status}: ${error.error?.message ?? response.statusText}`, response.status);
  }
  return response;
}

export function createAligner(ctx: ProviderContext): Aligner {
  return {
    id: alignManifest.id,
    async align(audio, text) {
      const form = new FormData();
      const wav = Buffer.from(audio.subarray(0, 4)).toString() === "RIFF";
      form.set("file", new Blob([Uint8Array.from(audio).buffer], { type: wav ? "audio/wav" : "audio/mpeg" }), wav ? "narration.wav" : "narration.mp3");
      form.set("model", "whisper-1");
      form.set("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      const response = await request(ctx, "transcriptions", form);
      const parsed = transcriptionSchema.safeParse(await response.json());
      if (!parsed.success) throw new ProviderError("OpenAI transcription returned no valid word timings", 502);
      return wordsFromAlignment(text, parsed.data.words.map(({ word, start, end }) => ({ text: word, start, end })));
    },
  };
}

export function create(ctx: ProviderContext): Speech {
  const aligner = createAligner(ctx);
  return {
    id: manifest.id,
    async synthesize(text, voice) {
      const options = { ...ctx.options, ...voice.options };
      const voiceId = voice.voiceId === "default" ? undefined : voice.voiceId;
      const body = {
        model: options.model ?? ctx.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
        voice: voiceId ?? ctx.env.OPENAI_TTS_VOICE ?? "marin",
        input: text,
        instructions: options.instructions ?? DEFAULT_INSTRUCTIONS,
        speed: options.speed ?? 1.03,
        response_format: "mp3",
      };
      // Retain synthesis across alignment retries so a transient transcription error does not rebill speech.
      const ref = { key: `generated/tts-openai/${inputHash(body)}.mp3`, contentType: "audio/mpeg" };
      let audio: Uint8Array;
      try {
        audio = await ctx.blob.get(ref);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const response = await request(ctx, "speech", JSON.stringify(body), true);
        audio = new Uint8Array(await response.arrayBuffer());
        if (!audio.byteLength) throw new ProviderError("OpenAI returned empty narration", 502);
        await ctx.blob.put(ref.key, audio, ref.contentType);
      }
      return { audio, contentType: ref.contentType, words: await aligner.align(audio, text) };
    },
  };
}
