import { defineManifest, type Aligner, type ProviderContext, ProviderError } from "@vcp/core";
import { wordsFromAlignment } from "@vcp/provider-tts-elevenlabs";

export const manifest = defineManifest({
  id: "align-elevenlabs",
  port: "Aligner",
  env: ["ELEVENLABS_API_KEY"],
  limits: { concurrency: 2 },
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  description: "ElevenLabs forced alignment. Used when Speech did not return word timings.",
});

interface AlignedWord {
  text?: string;
  start?: number;
  end?: number;
}

export function create(ctx: ProviderContext): Aligner {
  const apiKey = ctx.env.ELEVENLABS_API_KEY;
  return {
    id: manifest.id,
    async align(audio, text) {
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
      const wav = isWav(audio);
      const form = new FormData();
      form.set("text", text);
      form.set("file", new Blob([copyBytes(audio)], { type: wav ? "audio/wav" : "audio/mpeg" }), wav ? "narration.wav" : "narration.mp3");
      const res = await fetch("https://api.elevenlabs.io/v1/forced-alignment", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        detail?: { message?: string } | string;
        words?: AlignedWord[];
      };
      if (!res.ok) {
        const detail = body.detail;
        const message = typeof detail === "string" ? detail : (detail?.message ?? res.statusText);
        throw new ProviderError(`align-elevenlabs: ${res.status} ${message}`, res.status);
      }
      const timed = (body.words ?? [])
        .filter((word) => typeof word.text === "string")
        .map((word) => ({ text: word.text ?? "", start: word.start ?? 0, end: word.end ?? word.start ?? 0 }));
      return wordsFromAlignment(text, timed);
    },
  };
}

function copyBytes(audio: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(audio.byteLength);
  new Uint8Array(copy).set(audio);
  return copy;
}

function isWav(audio: Uint8Array): boolean {
  return audio.byteLength > 4 && audio[0] === 0x52 && audio[1] === 0x49 && audio[2] === 0x46 && audio[3] === 0x46;
}
