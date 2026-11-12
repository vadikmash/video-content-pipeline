import { defineManifest, type ProviderContext, type Speech, type Voice, ProviderError } from "@vcp/core";
import { wordsFromCharacters } from "./words";

export const manifest = defineManifest({
  id: "tts-elevenlabs",
  port: "Speech",
  env: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL"],
  limits: { concurrency: 2 },
  attributionRequired: false,
  costModel: { unit: "character", approxUsd: 0 },
  description:
    "ElevenLabs text-to-speech with character timestamps, collapsed to one word per input token. Voice id is Speech options.voiceId, else ELEVENLABS_VOICE_ID. Speech options.speed (0.7-1.2, default 1.1) keeps the voice's other saved settings.",
});

const DEFAULT_MODEL = "eleven_multilingual_v2";
/** Slightly faster than the voice's natural pace; ElevenLabs accepts 0.7-1.2. */
export const DEFAULT_SPEED = 1.1;

export { wordsFromAlignment, wordsFromCharacters } from "./words";

interface Alignment {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

export function create(ctx: ProviderContext): Speech {
  const apiKey = ctx.env.ELEVENLABS_API_KEY;
  const modelId = stringOpt(ctx.options.modelId) ?? ctx.env.ELEVENLABS_MODEL ?? DEFAULT_MODEL;
  const speed = clampSpeed(numberOpt(ctx.options.speed) ?? DEFAULT_SPEED);
  // voice_settings replaces the voice's saved settings wholesale, so fetch them once and override speed only.
  const savedSettings = new Map<string, Promise<Record<string, unknown>>>();
  const settingsFor = (voiceId: string) => {
    if (!savedSettings.has(voiceId)) savedSettings.set(voiceId, fetchVoiceSettings(apiKey!, voiceId));
    return savedSettings.get(voiceId)!;
  };
  return {
    id: manifest.id,
    async synthesize(text, voice) {
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
      const voiceId = resolveVoiceId(voice, ctx.env);
      const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`);
      url.searchParams.set("output_format", "mp3_44100_128");
      const res = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ text, model_id: modelId, voice_settings: { ...(await settingsFor(voiceId)), speed } }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        detail?: { message?: string } | string;
        audio_base64?: string;
        alignment?: Alignment;
        normalized_alignment?: Alignment;
      };
      if (!res.ok) throw new ProviderError(`tts-elevenlabs: ${res.status} ${detailMessage(body.detail) || res.statusText}`, res.status);
      if (!body.audio_base64) throw new Error("tts-elevenlabs: response had no audio");
      const audio = Uint8Array.from(Buffer.from(body.audio_base64, "base64"));
      const alignment = body.normalized_alignment?.characters?.length ? body.normalized_alignment : body.alignment;
      const words = alignment?.characters?.length
        ? wordsFromCharacters(
            text,
            alignment.characters,
            alignment.character_start_times_seconds ?? [],
            alignment.character_end_times_seconds ?? [],
          )
        : undefined;
      return { audio, contentType: "audio/mpeg", words };
    },
  };
}

export function resolveVoiceId(voice: Voice, env: Record<string, string | undefined>): string {
  if (voice.voiceId && voice.voiceId !== "default") return voice.voiceId;
  const fromEnv = env.ELEVENLABS_VOICE_ID;
  if (fromEnv) return fromEnv;
  throw new Error("tts-elevenlabs: set ELEVENLABS_VOICE_ID or Speech options.voiceId");
}

function detailMessage(detail: { message?: string } | string | undefined): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  return detail.message ?? "";
}

async function fetchVoiceSettings(apiKey: string, voiceId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}/settings`, {
    headers: { "xi-api-key": apiKey },
  });
  if (res.status === 401 || res.status === 403) {
    // The key lacks the voices_read permission. Send speed alone rather than fail the narration.
    console.warn(`tts-elevenlabs: cannot read saved settings for voice ${voiceId} (${res.status}); sending speed only`);
    return {};
  }
  if (!res.ok) throw new ProviderError(`tts-elevenlabs: voice settings ${res.status} ${res.statusText}`, res.status);
  const body = (await res.json()) as Record<string, unknown>;
  const { speed: _ignored, ...rest } = body;
  return rest;
}

export function clampSpeed(speed: number): number {
  return Math.min(1.2, Math.max(0.7, speed));
}

function numberOpt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
