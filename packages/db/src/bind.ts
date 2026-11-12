import { closeDb } from "./client";
import { setPortBinding } from "./repo/config";

/**
 * Point global port bindings at real providers when the matching keys are set.
 * Unlike seed, this overwrites the ports it touches. Ports with no key are left alone.
 * Fakes stay the default until this runs.
 */
async function main() {
  const bound: string[] = [];

  if (process.env.LLM_PROVIDER === "anthropic") {
    if (process.env.ANTHROPIC_API_KEY) {
      await setPortBinding("TextModel", "llm-anthropic");
      bound.push("TextModel -> llm-anthropic");
    } else {
      console.log("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset; TextModel unchanged");
    }
  } else if (process.env.OPENAI_API_KEY) {
    await setPortBinding("TextModel", "llm-openai");
    bound.push("TextModel -> llm-openai");
  } else if (process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY is set. Set LLM_PROVIDER=anthropic to bind llm-anthropic. TextModel unchanged.");
  }

  if (process.env.ELEVENLABS_API_KEY) {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const options = voiceId ? { voiceId } : {};
    await setPortBinding("Speech", "tts-elevenlabs", options);
    await setPortBinding("Aligner", "align-elevenlabs");
    bound.push(`Speech -> tts-elevenlabs${voiceId ? "" : " (set ELEVENLABS_VOICE_ID)"}`);
    bound.push("Aligner -> align-elevenlabs");
  }

  const youtube = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"] as const;
  const youtubeMissing = youtube.filter((key) => !process.env[key]);
  if (youtubeMissing.length === 0) {
    await setPortBinding("Publisher", "publish-youtube");
    bound.push("Publisher -> publish-youtube");
  } else if (youtubeMissing.length < youtube.length) {
    console.log(`YouTube left unchanged; missing ${youtubeMissing.join(", ")}`);
  }

  if (!bound.length) console.log("No real providers bound. Set keys in .env and run this again.");
  else for (const line of bound) console.log(line);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
