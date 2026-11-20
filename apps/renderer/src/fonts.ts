import { loadFont } from "@remotion/fonts";
import interUrl from "@fontsource/inter/files/inter-latin-700-normal.woff2";

export const CAPTION_FONT = "Inter, Arial, sans-serif";

export const captionFontReady = loadFont({ family: "Inter", url: interUrl, weight: "700" });
