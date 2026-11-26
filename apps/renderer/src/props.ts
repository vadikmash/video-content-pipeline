import { z } from "zod";
import { VectorAnimation } from "@vcp/core/animation";

/**
 * Props for the FactShort composition. The shared vector schema uses browser-safe
 * data types; the pipeline maps stored artifacts to these props.
 */

export const TEMPLATE_ID = "fact-short";
export const TEMPLATE_VERSION = "1.7.0";
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const CAPTION_LAYOUT = { fontSize: 64, top: 0.24, bottom: 0.68 } as const;

export const WordProp = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});

export const SceneAsset = z.object({
  kind: z.enum(["video", "image", "audio"]),
  url: z.string(),
  attribution: z.string().optional(),
  durationSec: z.number().positive().optional(),
});

export const SceneProp = z.object({
  beatId: z.string(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  kind: z.enum(["type", "stock", "still", "clip", "diagram", "animation"]),
  animation: VectorAnimation.optional(),
  captionPosition: z.enum(["top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  asset: SceneAsset.optional(),
  diagram: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("orbital-freefall"), focus: z.enum(["cabin", "gravity", "falling", "orbit"]), language: z.enum(["en", "ru"]).optional() }),
    z.object({ kind: z.literal("flow"), steps: z.array(z.object({ label: z.string(), detail: z.string() })) }),
    z.object({ kind: z.literal("lunar-eclipse"), focus: z.enum(["alignment", "refraction", "dispersion", "scattering", "illumination"]), language: z.enum(["en", "ru"]).optional() }),
    z.object({ kind: z.literal("octopus-circulation"), focus: z.enum(["gills", "body", "cycle"]) }),
  ]).optional(),
});

export const FactShortProps = z.object({
  title: z.string(),
  durationSec: z.number().positive(),
  audioUrl: z.string().optional(),
  words: z.array(WordProp),
  scenes: z.array(SceneProp),
  /** Optional music bed, ducked under narration (see music.ts). Omitted when no bed file is configured. */
  musicUrl: z.string().optional(),
});
export type FactShortProps = z.infer<typeof FactShortProps>;
export type SceneProp = z.infer<typeof SceneProp>;
export type WordProp = z.infer<typeof WordProp>;

export const defaultProps: FactShortProps = {
  title: "Placeholder title",
  durationSec: 6,
  words: [
    { text: "This", start: 0, end: 0.4 },
    { text: "is", start: 0.4, end: 0.8 },
    { text: "a", start: 0.8, end: 1.2 },
    { text: "placeholder", start: 1.2, end: 1.6 },
    { text: "render.", start: 1.6, end: 2.0 },
  ],
  scenes: [
    { beatId: "beat-1", start: 0, end: 3, text: "This is a placeholder render.", kind: "type" },
    { beatId: "beat-2", start: 3, end: 6, text: "Second beat, still a placeholder.", kind: "type" },
  ],
};
