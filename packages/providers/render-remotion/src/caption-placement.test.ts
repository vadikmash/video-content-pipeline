import { expect, it } from "vitest";
import { quietCaptionPosition } from "./caption-placement";

function picture(detailAt: "top" | "bottom") {
  const frame = new Uint8Array(108 * 192);
  const center = Math.round(192 * (detailAt === "top" ? 0.27 : 0.76));
  for (let y = center - 15; y < center + 15; y++) {
    for (let x = 9; x < 90; x++) frame[y * 108 + x] = (x + y) % 2 ? 255 : 0;
  }
  return frame;
}

it("places captions away from detailed regions in the portrait frame", () => {
  expect(quietCaptionPosition([picture("top")])).toBe("bottom");
  expect(quietCaptionPosition([picture("bottom")])).toBe("top");
  expect(quietCaptionPosition([new Uint8Array(108 * 192)])).toBe("bottom");
});

it("scores multiple samples so one quiet moment does not hide later action", () => {
  expect(quietCaptionPosition([new Uint8Array(108 * 192), picture("bottom")])).toBe("top");
  expect(quietCaptionPosition([])).toBe("bottom");
});
