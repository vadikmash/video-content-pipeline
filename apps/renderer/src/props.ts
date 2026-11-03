import { z } from "zod";

/**
 * Props for the FactShort composition. Kept free of workspace imports so the
 * Remotion bundle stays self-contained; the pipeline maps core artifacts to this.
 */

export const TEMPLATE_ID = "fact-short";
export const TEMPLATE_VERSION = "0.1.0";
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

export const WordProp = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});

export const SceneAsset = z.object({
  kind: z.enum(["video", "image", "audio"]),
  url: z.string(),
  attribution: z.string().optional(),
});

export const SceneProp = z.object({
  beatId: z.string(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  kind: z.enum(["type", "stock", "still", "clip", "diagram"]),
  asset: SceneAsset.optional(),
});

export const FactShortProps = z.object({
  title: z.string(),
  durationSec: z.number().positive(),
  audioUrl: z.string().optional(),
  words: z.array(WordProp),
  scenes: z.array(SceneProp),
  sources: z.array(z.string()).default([]),
  /** Shown on the closing card when true. */
  containsSyntheticMedia: z.boolean().default(false),
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
  sources: ["https://example.org/source"],
  containsSyntheticMedia: false,
};
