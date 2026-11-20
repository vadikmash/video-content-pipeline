import { afterEach, expect, it, vi } from "vitest";
import { create, createAligner } from "./index";

afterEach(() => vi.unstubAllGlobals());

it("retains synthesized audio when alignment fails and returns the original script tokens on retry", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const files = new Map<string, Uint8Array>();
  const ctx = {
    options: {}, env: { OPENAI_API_KEY: "test" },
    blob: {
      id: "memory-blob",
      get: async (ref: {key: string}) => {
        const value = files.get(ref.key);
        if (!value) throw Object.assign(new Error("missing"), {code:"ENOENT"});
        return value;
      },
      put: async (key: string, value: Uint8Array, contentType: string) => {
        files.set(key,value);
        return {key,contentType};
      },
      url: async () => "",
    },
  };
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(bytes))
    .mockResolvedValueOnce(Response.json({error:{message:"Temporary failure"}}, {status:503}))
    .mockResolvedValueOnce(Response.json({words:[
      {word:"The",start:0,end:0.2},{word:"moon",start:0.2,end:0.6},{word:"glows",start:0.6,end:1.0},
    ]}));
  vi.stubGlobal("fetch", fetch);
  await expect(create(ctx).synthesize("The Moon glows.", {voiceId:"default"})).rejects.toMatchObject({status:503});
  const result = await create(ctx).synthesize("The Moon glows.", {voiceId:"default"});
  expect(result.words?.map((word) => word.text)).toEqual(["The","Moon","glows."]);
  expect(result.audio).toEqual(bytes);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toMatchObject({voice:"marin",speed:1.03,model:"gpt-4o-mini-tts"});
  expect(String(fetch.mock.calls[2]![0])).toContain("/transcriptions");
});

it("fails on missing word timestamps instead of silently using synthetic timings", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({words:[]})));
  const aligner = createAligner({options:{},env:{OPENAI_API_KEY:"test"},blob:undefined!});
  await expect(aligner.align(new Uint8Array([1]),"hello")).rejects.toMatchObject({status:502});
});

it("rejects unrelated transcription text instead of interpolating the whole narration", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({words:[
    {word:"unrelated",start:0,end:0.3},{word:"content",start:0.3,end:0.8},
  ]})));
  const aligner = createAligner({options:{},env:{OPENAI_API_KEY:"test"},blob:undefined!});
  await expect(aligner.align(new Uint8Array([1]),"The Moon turns red during an eclipse."))
    .rejects.toMatchObject({status:502});
});
