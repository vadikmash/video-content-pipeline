import { loadFont } from "@remotion/fonts";
import interUrl from "@fontsource/inter/files/inter-latin-700-normal.woff2";

import cyrillicUrl from "@fontsource/inter/files/inter-cyrillic-700-normal.woff2";

export const CAPTION_FONT = "Inter, Inter Cyrillic, Arial, sans-serif";

export const captionFontReady = Promise.all([
  loadFont({ family: "Inter", url: interUrl, weight: "700" }),
  loadFont({ family: "Inter Cyrillic", url: cyrillicUrl, weight: "700" }),
]);
