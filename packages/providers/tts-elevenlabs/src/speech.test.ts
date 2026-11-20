import { afterEach, expect, it, vi } from "vitest";
import { create } from "./index";

afterEach(() => vi.unstubAllGlobals());

it("uses explicit Eleven v3 delivery settings without needing voice-read access or sending speed", async () => {
  const text="Hello Moon.";
  const fetch=vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({
    audio_base64:Buffer.from([1,2,3]).toString("base64"),
    alignment:{
      characters:[...text],
      character_start_times_seconds:[...text].map((_,i)=>i*0.1),
      character_end_times_seconds:[...text].map((_,i)=>(i+1)*0.1),
    },
  }));
  vi.stubGlobal("fetch",fetch);
  const speech=create({
    options:{modelId:"eleven_v3",voiceSettings:{stability:0.5},speed:1.1},
    env:{ELEVENLABS_API_KEY:"test"},blob:undefined!,
  });
  const result=await speech.synthesize(text,{voiceId:"test-voice"});
  expect(result.words?.map((word)=>word.text)).toEqual(["Hello","Moon."]);
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
    text,model_id:"eleven_v3",voice_settings:{stability:0.5},
  });
});
