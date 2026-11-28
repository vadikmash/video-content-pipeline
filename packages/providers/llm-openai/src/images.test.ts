import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PromptUsage } from "@vcp/core";
import { create } from "./index";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const blob = {} as never;
afterEach(() => vi.unstubAllGlobals());

describe("llm-openai image prompts", () => {
  it("sends data-URL image parts and reports usage", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ id: "chatcmpl_1", model: "gpt-4.1-2025", choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 900, completion_tokens: 12, prompt_tokens_details: { cached_tokens: 100 } } }), { status: 200, headers: { "x-request-id": "req_9" } });
    }));
    const usage: PromptUsage[] = [];
    const model = create({ env: { OPENAI_API_KEY: "test" }, options: { model: "gpt-4.1" }, blob });
    expect(model.capabilities?.images).toBe(true);
    await model.generate(z.object({ ok: z.boolean() }), { kind: "other", user: "Look.", images: [{ mediaType: "image/png", data: PNG, label: "frame 1" }], onUsage: (u) => usage.push(u) });
    const content = (requests[0]!.messages as { content: unknown }[])[1]!.content as Record<string, unknown>[];
    expect(content.map((p) => p.type)).toEqual(["text", "image_url", "text"]);
    expect((content[1]!.image_url as { url: string }).url).toBe(`data:image/png;base64,${Buffer.from(PNG).toString("base64")}`);
    expect(usage).toEqual([{ provider: "llm-openai", model: "gpt-4.1-2025", requestId: "req_9", repair: 0, inputTokens: 900, outputTokens: 12, cacheReadTokens: 100 }]);
  });

  it("returns a capability error for a text-only model", async () => {
    const model = create({ env: { OPENAI_API_KEY: "test" }, options: { model: "gpt-3.5-turbo" }, blob });
    expect(model.capabilities?.images).toBe(false);
    await expect(model.generate(z.object({}), { kind: "other", user: "x", images: [{ mediaType: "image/png", data: PNG }] })).rejects.toThrow(/does not accept image input/);
  });
});
