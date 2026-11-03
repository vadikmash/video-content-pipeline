import { defineManifest, type ProviderContext, type Speech, type Word } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-tts",
  port: "Speech",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "character", approxUsd: 0 },
  fake: true,
  description: "Silent WAV sized to the text (0.4 s per word) with evenly spaced word timings.",
});

export const SECONDS_PER_WORD = 0.4;
const SAMPLE_RATE = 16_000;

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Evenly spaced timings; shared with fake-align so the two agree. */
export function evenWords(text: string, totalSec?: number): Word[] {
  const tokens = tokenize(text);
  const per = totalSec !== undefined && tokens.length ? totalSec / tokens.length : SECONDS_PER_WORD;
  return tokens.map((t, i) => ({ text: t, start: round(i * per), end: round((i + 1) * per) }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** 16-bit mono PCM WAV of silence. */
export function silentWav(seconds: number, sampleRate = SAMPLE_RATE): Uint8Array {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const dataBytes = samples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  return new Uint8Array(buf);
}

export function wavDurationSec(bytes: Uint8Array): number {
  if (bytes.byteLength < 44) return 0;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteRate = v.getUint32(28, true);
  const dataBytes = v.getUint32(40, true);
  return byteRate ? dataBytes / byteRate : 0;
}

export function create(ctx: ProviderContext): Speech {
  const withWords = ctx.options.returnWords !== false;
  return {
    id: manifest.id,
    async synthesize(text) {
      const words = evenWords(text);
      const seconds = words.length ? words[words.length - 1]!.end : 1;
      return {
        audio: silentWav(seconds),
        contentType: "audio/wav",
        words: withWords ? words : undefined,
      };
    },
  };
}
