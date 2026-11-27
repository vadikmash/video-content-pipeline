import { describe, expect, it } from "vitest";
import { formatInZone, isTimeZone, zonedTimeToInstant } from "./time";

describe("zonedTimeToInstant", () => {
  it("reads the wall time in the reviewer's zone", () => {
    expect(zonedTimeToInstant("2026-12-01T18:30", "Europe/Moscow")).toBe("2026-12-01T15:30:00.000Z");
    expect(zonedTimeToInstant("2026-07-01T09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedTimeToInstant("2026-12-01T09:00", "America/New_York")).toBe("2026-12-01T14:00:00.000Z");
    expect(zonedTimeToInstant("2026-12-01T09:00", "UTC")).toBe("2026-12-01T09:00:00.000Z");
  });

  it("resolves a wall time skipped by DST forward and an ambiguous one to the earlier instant", () => {
    // 2026-03-08 02:30 does not exist in New York; 2026-11-01 01:30 happens twice.
    expect(zonedTimeToInstant("2026-03-08T02:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
    expect(zonedTimeToInstant("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  });

  it("round-trips through formatInZone", () => {
    const iso = zonedTimeToInstant("2026-12-24T07:05", "Asia/Kolkata");
    expect(formatInZone(iso, "Asia/Kolkata")).toBe("2026-12-24 07:05");
  });

  it("rejects unknown zones and malformed input", () => {
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(() => zonedTimeToInstant("2026-12-01T09:00", "Mars/Olympus")).toThrow(/time zone/);
    expect(() => zonedTimeToInstant("tomorrow", "UTC")).toThrow(/local date-time/);
  });
});
