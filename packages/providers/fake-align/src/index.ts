import { defineManifest, type Aligner, type ProviderContext, type Word } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-align",
  port: "Aligner",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "second", approxUsd: 0 },
  fake: true,
  description: "Spreads the words evenly over the audio duration read from the WAV header.",
});

function wavDurationSec(bytes: Uint8Array): number | undefined {
  if (bytes.byteLength < 44) return undefined;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (riff !== "RIFF") return undefined;
  const byteRate = v.getUint32(28, true);
  const dataBytes = v.getUint32(40, true);
  return byteRate ? dataBytes / byteRate : undefined;
}

export function create(_ctx: ProviderContext): Aligner {
  return {
    id: manifest.id,
    async align(audio, text): Promise<Word[]> {
      const tokens = text.split(/\s+/).filter(Boolean);
      if (!tokens.length) return [];
      const total = wavDurationSec(audio) ?? tokens.length * 0.4;
      const per = total / tokens.length;
      const r = (n: number) => Math.round(n * 1000) / 1000;
      return tokens.map((t, i) => ({ text: t, start: r(i * per), end: r((i + 1) * per) }));
    },
  };
}
