import { describe, expect, it } from "vitest";
import { ProviderError, isPermanentError } from "./errors";

describe("ProviderError", () => {
  it("treats auth, scope and bad-request errors as permanent", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isPermanentError(new ProviderError("x", status))).toBe(true);
    }
  });
  it("retries timeouts, rate limits, server and network errors", () => {
    for (const status of [408, 429, 500, 503, undefined]) {
      expect(isPermanentError(new ProviderError("x", status))).toBe(false);
    }
  });
  it("lets the caller override", () => {
    expect(isPermanentError(new ProviderError("x", 500, false))).toBe(true);
  });
  it("leaves plain errors retriable", () => {
    expect(isPermanentError(new Error("x"))).toBe(false);
    expect(isPermanentError("x")).toBe(false);
  });
});
