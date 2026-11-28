import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PromptUsage } from "@vcp/core";
import { create } from "./index";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const blob = {} as never;

function respond(bodies: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(bodies.shift()), { status: 200, headers: { "content-type": "application/json", "request-id": `req_${requests.length}` } });
  }));
  return requests;
}
const message = (text: string, model = "claude-opus-5-5") => ({
  id: "msg_1", type: "message", role: "assistant", model, stop_reason: "end_turn", stop_details: null,
  content: [{ type: "text", text }],
  usage: { input_tokens: 1200, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
});

afterEach(() => vi.unstubAllGlobals());

describe("llm-anthropic image prompts", () => {
  it("sends labelled base64 image blocks before the text and reports usage per response, including a repair", async () => {
    const requests = respond([message('{"wrong":1}'), message('{"ok":true}', "claude-opus-4-8")]);
    const usage: PromptUsage[] = [];
    const model = create({ env: { ANTHROPIC_API_KEY: "test" }, options: { model: "claude-opus-5-5", effort: "high" }, blob });
    expect(model.capabilities).toEqual({ images: true, model: "claude-opus-5-5" });
    const out = await model.generate(z.object({ ok: z.boolean() }), {
      kind: "other", user: "Judge the frames.", images: [{ mediaType: "image/jpeg", data: JPEG, label: "frame 607" }], onUsage: (u) => usage.push(u),
    });
    expect(out).toEqual({ ok: true });
    const content = (requests[0]!.messages as { content: unknown }[])[0]!.content as Record<string, unknown>[];
    expect(content.map((b) => b.type)).toEqual(["text", "image", "text"]);
    expect(content[0]).toEqual({ type: "text", text: "frame 607" });
    expect(content[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(JPEG).toString("base64") } });
    expect(content[2]!.text).toContain("Judge the frames.");
    // The repair request keeps the images and appends the validation error.
    const repair = (requests[1]!.messages as { content: Record<string, unknown>[] }[])[0]!.content;
    expect(repair[1]!.type).toBe("image");
    expect(String(repair[2]!.text)).toContain("failed validation");
    expect(usage.map((u) => [u.repair, u.model, u.inputTokens, u.outputTokens])).toEqual([[0, "claude-opus-5-5", 1200, 40], [1, "claude-opus-4-8", 1200, 40]]);
  });

  it("rejects mislabelled or oversized images before any request", async () => {
    const requests = respond([]);
    const model = create({ env: { ANTHROPIC_API_KEY: "test" }, options: {}, blob });
    await expect(model.generate(z.object({}), { kind: "other", user: "x", images: [{ mediaType: "image/png", data: JPEG }] })).rejects.toThrow(/not a valid image\/png/);
    await expect(model.generate(z.object({}), { kind: "other", user: "x", images: Array.from({ length: 21 }, () => ({ mediaType: "image/jpeg" as const, data: JPEG })) })).rejects.toThrow(/limit is 20/);
    expect(requests).toHaveLength(0);
  });
});

describe("maxTokens", () => {
  it("lets a prompt raise its output cap up to the model limit", async () => {
    const { maxTokens } = await import("./index");
    expect(maxTokens({ kind: "script" })).toBe(16000);
    expect(maxTokens({ kind: "animation" })).toBe(32000);
    expect(maxTokens({ kind: "animation", maxOutputTokens: 64000 })).toBe(64000);
    expect(maxTokens({ kind: "animation", maxOutputTokens: 500_000 })).toBe(128_000);
  });
});

describe("streamedErrorStatus", () => {
  it("keeps an error event from a stream permanent", async () => {
    const { streamedErrorStatus } = await import("./index");
    const billing = '{"type":"error","error":{"details":null,"type":"invalid_request_error","message":"Your credit balance is too low"}}';
    expect(streamedErrorStatus({ message: billing })).toBe(400);
    expect(streamedErrorStatus({ error: { type: "error", error: { type: "overloaded_error" } } })).toBe(529);
    expect(streamedErrorStatus({ message: "socket hang up" })).toBeUndefined();
  });
});
