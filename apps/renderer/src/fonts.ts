import { loadFont } from "@remotion/fonts";
import antonUrl from "@fontsource/anton/files/anton-latin-400-normal.woff2";

/**
 * Caption face. Impact is used when the render machine has it (macOS, Windows);
 * Anton is an open-licensed (OFL) near-identical fallback bundled for Linux render hosts.
 * Anton covers Latin only: Cyrillic captions would fall back to the system font.
 */
export const CAPTION_FONT = "Impact, Anton, 'Arial Black', sans-serif";

loadFont({ family: "Anton", url: antonUrl, weight: "400" }).catch(() => {
  // Rendering continues with Impact or the system fallback.
});
