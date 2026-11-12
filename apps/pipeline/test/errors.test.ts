import { ProviderError, STAGES, retryTrigger } from "@vcp/core";
import { Deferred } from "@vcp/limits";
import { NonRetriableError, RetryAfterError } from "inngest";
import { describe, expect, it } from "vitest";
import { mapError } from "../src/errors";
import { StageError, publish, runStage } from "../src/stages/index";
import { makeWorld } from "./helpers";

const mapped = (err: unknown) => {
  try {
    mapError(err);
  } catch (e) {
    return e;
  }
};

describe("mapError", () => {
  it("fails at once on a 4xx from a provider (e.g. missing OAuth scope)", () => {
    const out = mapped(new ProviderError("publish-youtube: update 403 insufficient scopes", 403));
    expect(out).toBeInstanceOf(NonRetriableError);
    expect((out as Error).message).toContain("403");
  });
  it("fails at once on a non-retriable StageError", () => {
    expect(mapped(new StageError("missing input", false))).toBeInstanceOf(NonRetriableError);
  });
  it("lets rate limits, server and unknown errors retry", () => {
    for (const err of [new ProviderError("x", 429), new ProviderError("x", 503), new Error("socket hang up")]) {
      expect(mapped(err)).toBe(err);
    }
  });
  it("defers on the rate-limit ledger", () => {
    expect(mapped(new Deferred("p", 1000))).toBeInstanceOf(RetryAfterError);
  });
});

describe("retryTrigger", () => {
  it("re-sends stage.completed of the previous stage, or idea.selected for the first", () => {
    expect(retryTrigger("research")).toEqual({ event: "idea.selected" });
    expect(retryTrigger("publish")).toEqual({ event: "stage.completed", after: "approve-publish" });
    for (const stage of STAGES.slice(1)) {
      const t = retryTrigger(stage);
      expect(t.event).toBe("stage.completed");
    }
  });
});

describe("a publisher that rejects with 403", () => {
  it("marks the publish stage failed with a permanent error", async () => {
    const world = makeWorld();
    try {
      // Run up to upload on fakes, then swap in a publisher whose setPrivacy 403s.
      const { WORK_STAGES } = await import("../src/stages/index");
      for (const def of WORK_STAGES) {
        if (def.name === "publish") break;
        await runStage(def, world.project.id, world.deps);
      }
      world.registry.register(
        { id: "pub-403", port: "Publisher", env: [], limits: {}, attributionRequired: false, costModel: { unit: "request", approxUsd: 0 } },
        () => ({
          id: "pub-403",
          upload: async () => {
            throw new Error("unused");
          },
          setPrivacy: async () => {
            throw new ProviderError("pub-403: update 403 insufficient scopes", 403);
          },
          status: async (u) => u,
        }),
      );
      world.config.ports.Publisher = { providerId: "pub-403", options: {} };
      const err = await runStage(publish, world.project.id, world.deps).catch((e) => e);
      expect(mapped(err)).toBeInstanceOf(NonRetriableError);
      expect((await world.store.getStage(world.project.id, "publish"))?.status).toBe("failed");
    } finally {
      world.cleanup();
    }
  });
});
