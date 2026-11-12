import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  defineManifest,
  parseWithOneRetry,
  promptText,
  strictJsonSchema,
  type ProviderContext,
  type TextModel,
} from "@vcp/core";

export const manifest = defineManifest({
  id: "llm-anthropic",
  port: "TextModel",
  env: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "token", approxUsd: 0 },
  description:
    "Anthropic Messages with structured outputs (output_config.format json_schema). Model id is ANTHROPIC_MODEL or options.model (default claude-opus-5-5).",
});

const DEFAULT_MODEL = "claude-opus-5-5";
/** Script and brief writing is moderate work; Opus 5.5 defaults to medium, set it explicitly. */
const DEFAULT_EFFORT = "medium";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export function create(ctx: ProviderContext): TextModel {
  const apiKey = ctx.env.ANTHROPIC_API_KEY;
  const model = stringOpt(ctx.options.model) ?? ctx.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const effort = (stringOpt(ctx.options.effort) ?? DEFAULT_EFFORT) as Effort;
  let client: Anthropic | undefined;
  return {
    id: manifest.id,
    async generate(schema, prompt) {
      if (!apiKey) throw new ProviderError("ANTHROPIC_API_KEY is not set", undefined, false);
      client ??= new Anthropic({ apiKey });
      const jsonSchema = strictJsonSchema(schema);
      const { system, user } = promptText(prompt);
      return parseWithOneRetry(schema, user, (message) =>
        complete(client!, model, effort, jsonSchema, system, message),
      );
    },
  };
}

async function complete(
  client: Anthropic,
  model: string,
  effort: Effort,
  schema: Record<string, unknown>,
  system: string,
  user: string,
): Promise<unknown> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort, format: { type: "json_schema", schema } },
      // On a safety decline, the API re-runs the request on a fallback model it picks.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new ProviderError(`llm-anthropic: ${err.status ?? "network"} ${err.message}`, err.status);
    }
    throw err;
  }
  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category ?? "unspecified";
    throw new ProviderError(`llm-anthropic: refused (${category})`, undefined, false);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ProviderError("llm-anthropic: output hit max_tokens", undefined, true);
  }
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return undefined;
  try {
    return JSON.parse(text.text) as unknown;
  } catch {
    return undefined;
  }
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
