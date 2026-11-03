import { describe, expect, it } from "vitest";
import { z } from "zod";
import { inputHash } from "./hash";
import { ProviderRegistry, withDefaultGates } from "./registry";
import { VisualIntent } from "./schemas";
import { nextStage } from "./stages";

describe("inputHash", () => {
  it("is independent of key order and undefined fields", () => {
    expect(inputHash({ a: 1, b: [1, { c: 2, d: undefined }] })).toBe(inputHash({ b: [1, { c: 2 }], a: 1 }));
  });
  it("changes when content changes", () => {
    expect(inputHash({ a: 1 })).not.toBe(inputHash({ a: 2 }));
  });
});

describe("schemas", () => {
  it("VisualIntent discriminates on kind", () => {
    expect(VisualIntent.parse({ kind: "type" })).toEqual({ kind: "type" });
    expect(() => VisualIntent.parse({ kind: "stock" })).toThrow();
  });
});

describe("stages", () => {
  it("orders stages", () => {
    expect(nextStage("write")).toBe("approve-script");
    expect(nextStage("publish")).toBeUndefined();
  });
  it("fills default gate modes", () => {
    const cfg = withDefaultGates({ ports: {}, gates: { "approve-publish": "auto" } });
    expect(cfg.gates).toEqual({ "approve-script": "manual", "approve-video": "manual", "approve-publish": "auto" });
  });
});

describe("ProviderRegistry", () => {
  it("resolves by port binding", () => {
    const reg = new ProviderRegistry().register(
      {
        id: "fake-llm",
        port: "TextModel",
        env: [],
        limits: {},
        attributionRequired: false,
        costModel: { unit: "token", approxUsd: 0 },
      },
      () => ({ id: "fake-llm", generate: async <T,>(s: z.ZodType<T>) => s.parse({}) }),
    );
    const llm = reg.resolve("TextModel", { ports: { TextModel: { providerId: "fake-llm", options: {} } }, gates: {} });
    expect(llm.id).toBe("fake-llm");
    expect(() => reg.resolve("Speech", { ports: { Speech: { providerId: "fake-llm", options: {} } }, gates: {} })).toThrow();
  });
});
