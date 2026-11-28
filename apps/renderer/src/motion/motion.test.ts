import { describe, expect, it } from "vitest";
import { anticipate, burst, cameraAt, cameraTransform, cueFrame, ease, morphIncompatibility, morphPath, parsePath, projectPoint, random, settle, tween } from "./index";

describe("timing", () => {
  const keys = [{ frame: 10, value: 0 }, { frame: 20, value: 100, ease: ease.linear }, { frame: 30, value: 100, ease: ease.hold }, { frame: 40, value: 0, ease: ease.out(3) }];
  it("holds before the first and after the last key and evaluates any frame directly", () => {
    expect(tween(0, keys)).toBe(0);
    expect(tween(15, keys)).toBe(50);
    expect(tween(25, keys)).toBe(100);
    expect(tween(35, keys)).toBeCloseTo(100 - 100 * (1 - 0.5 ** 3));
    expect(tween(99, keys)).toBe(0);
    const ascending = Array.from({ length: 50 }, (_, f) => tween(f, keys));
    const shuffled = [37, 3, 22, 49, 10, 15, 0, 29].map((f) => tween(f, keys));
    expect(shuffled).toEqual([37, 3, 22, 49, 10, 15, 0, 29].map((f) => ascending[f]));
  });

  it("supports cubic bezier, ease-in and hold, and rejects out-of-order keys", () => {
    const bezier = ease.bezier(0.16, 1, 0.3, 1);
    expect(bezier(0)).toBe(0);
    expect(bezier(1)).toBeCloseTo(1);
    expect(bezier(0.2)).toBeGreaterThan(0.5);
    expect(ease.in(2)(0.5)).toBe(0.25);
    expect(ease.hold(0.99)).toBe(0);
    expect(() => ease.bezier(1.2, 0, 0, 1)).toThrow();
    expect(() => tween(0, [{ frame: 5, value: 0 }, { frame: 4, value: 1 }])).toThrow(/order/);
  });

  it("anticipates against the move, overshoots and settles at the target", () => {
    const keys = anticipate({ from: 0, to: 100, start: 20, end: 30 });
    expect(tween(20, keys)).toBeLessThan(0);
    expect(tween(30, keys)).toBeGreaterThan(100);
    expect(tween(60, keys)).toBe(100);
  });

  it("springs settle to the target with a damped overshoot", () => {
    const values = Array.from({ length: 90 }, (_, f) => settle(f, { start: 10, from: 0, to: 1, fps: 30, damping: 9 }));
    expect(values[5]).toBe(0);
    expect(Math.max(...values)).toBeGreaterThan(1);
    expect(values[89]).toBeCloseTo(1, 2);
  });

  it("resolves named cues with bounded offsets", () => {
    expect(cueFrame({ ruptures: 223 }, "ruptures", -6)).toBe(217);
    expect(() => cueFrame({}, "ruptures")).toThrow(/Unknown cue/);
    expect(() => cueFrame({ a: 1 }, "a", 31)).toThrow();
  });
});

describe("particles", () => {
  const opts = { seed: 7, start: 100, count: 30, origin: { x: 500, y: 500 }, lifetime: [20, 40] as [number, number] };
  it("is deterministic, bounded and varied per particle", () => {
    expect(burst(99, opts)).toEqual([]);
    expect(burst(120, opts)).toEqual(burst(120, opts));
    const live = burst(110, opts);
    expect(live).toHaveLength(30);
    expect(new Set(live.map((p) => Math.round(p.x))).size).toBeGreaterThan(20);
    expect(burst(141, opts)).toEqual([]);
    expect(burst(120, { ...opts, seed: 8 })).not.toEqual(burst(120, opts));
    expect(() => burst(0, { ...opts, count: 241 })).toThrow();
    expect(() => burst(0, { ...opts, lifetime: [10, 500] })).toThrow();
  });
  it("hashes seeds into [0, 1)", () => {
    const values = Array.from({ length: 1000 }, (_, i) => random(3, i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(random(3, 1, "a")).toBe(random(3, 1, "a"));
  });
});

describe("path morphs", () => {
  const a = "M0 0 L10 0 Q20 10 10 20 Z";
  const b = "M0 0 L30 0 Q40 30 10 60 Z";
  it("interpolates matched topology and keeps endpoints exact", () => {
    expect(morphPath(a, b, 0)).toBe("M0 0 L10 0 Q20 10 10 20 Z");
    expect(morphPath(a, b, 1)).toBe("M0 0 L30 0 Q40 30 10 60 Z");
    expect(morphPath(a, b, 0.5)).toBe("M0 0 L20 0 Q30 20 10 40 Z");
  });
  it("reports incompatible paths at validation", () => {
    expect(morphIncompatibility(a, "M0 0 L10 0 L10 20 Z")).toMatch(/differs/);
    expect(morphIncompatibility(a, "M0 0 L10 0 Z")).toMatch(/commands/);
    expect(morphIncompatibility("M0 0 L", a)).toMatch(/missing/);
    expect(() => morphPath(a, "M0 0 Z", 0.5)).toThrow(/Cannot morph/);
    expect(parsePath("M1 2 3 4").commands).toEqual(["M", "L"]);
  });
});

describe("camera", () => {
  it("keeps the focus point at the anchor while zooming", () => {
    const keys = [
      { frame: 0, focus: { x: 540, y: 760 }, zoom: 1, anchor: { x: 540, y: 760 } },
      { frame: 30, focus: { x: 600, y: 800 }, zoom: 2, anchor: { x: 540, y: 760 } },
    ];
    const mid = cameraAt(15, keys);
    expect(projectPoint(mid, mid.focus)).toEqual({ x: 540, y: 760 });
    expect(cameraAt(30, keys).zoom).toBeCloseTo(2);
    expect(cameraAt(15, [keys[0]!, { ...keys[1]!, ease: ease.linear }]).zoom).toBeCloseTo(Math.SQRT2);
    expect(cameraTransform(cameraAt(0, keys))).toBe("translate(540 760) scale(1) translate(-540 -760)");
  });
});
