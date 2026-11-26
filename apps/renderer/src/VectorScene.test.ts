import { describe, expect, it } from "vitest";
import { motionValue } from "./VectorScene";

describe("vector motion frames", () => {
  it("uses the same absolute rounding as scene sequences", () => {
    const track = {
      nodeId: "shape",
      property: "y" as const,
      keyframes: [
        { time: 10.03, value: 0 },
        { time: 10.1, value: 100 },
      ],
    };
    expect(motionValue(track, 0, 30, 10.015)).toBe(0);
    expect(motionValue(track, 3, 30, 10.015)).toBe(100);
  });

  it("holds the last value when nearby word anchors quantize to one frame", () => {
    const track = {
      nodeId: "shape",
      property: "opacity" as const,
      keyframes: [
        { time: 1.001, value: 0 },
        { time: 1.005, value: 1 },
      ],
    };
    expect(motionValue(track, 0, 30, 1)).toBe(1);
  });
});
