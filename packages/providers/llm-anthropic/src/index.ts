import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  defineManifest,
  parseWithOneRetry,
  promptText,
  strictJsonSchema,
  validatePromptImages,
  type Prompt,
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
    capabilities: { images: supportsImages(model), model },
    async generate(schema, prompt) {
      if (!apiKey) throw new ProviderError("ANTHROPIC_API_KEY is not set", undefined, false);
      validatePromptImages(manifest.id, prompt.images, supportsImages(model));
      client ??= new Anthropic({ apiKey });
      const jsonSchema = strictJsonSchema(schema);
      const { system, user } = promptText(prompt);
      return parseWithOneRetry(schema, user, (message, repair) =>
        complete(client!, model, effort, jsonSchema, system, userContent(prompt, message), maxTokens(prompt), prompt, repair),
      );
    },
  };
}

/** Current Claude models cap output (thinking included) at 128K; long outputs stream. */
const MAX_OUTPUT_TOKENS = 128_000;
export function maxTokens(prompt: Pick<Prompt, "kind" | "maxOutputTokens">): number {
  return Math.min(MAX_OUTPUT_TOKENS, prompt.maxOutputTokens ?? (prompt.kind === "animation" ? 32000 : 16000));
}

/** Every current Claude model accepts images; only the retired 2.x/instant models did not. */
export function supportsImages(model: string): boolean {
  return !/^claude-(instant|2)/.test(model);
}

/** Image blocks (each after its label) before the instruction text. */
export function userContent(prompt: Pick<Prompt, "images">, text: string): string | Anthropic.Beta.BetaContentBlockParam[] {
  if (!prompt.images?.length) return text;
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const image of prompt.images) {
    if (image.label) blocks.push({ type: "text", text: image.label });
    blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: Buffer.from(image.data).toString("base64") } });
  }
  blocks.push({ type: "text", text });
  return blocks;
}

async function complete(
  client: Anthropic,
  model: string,
  effort: Effort,
  schema: Record<string, unknown>,
  system: string,
  user: string | Anthropic.Beta.BetaContentBlockParam[],
  maxTokens: number,
  prompt: Pick<Prompt, "onUsage" | "signal">,
  repair: number,
): Promise<unknown> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    const request = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user" as const, content: user }],
      output_config: { effort, format: { type: "json_schema" as const, schema } },
      // On a safety decline, the API re-runs the request on a fallback model it picks.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    };
    const options = { signal: prompt.signal };
    response = maxTokens > 16000
      ? await client.beta.messages.stream(request, options).finalMessage()
      : await client.beta.messages.create(request, options);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? streamedErrorStatus(err);
      throw new ProviderError(`llm-anthropic: ${status ?? "network"} ${err.message}`, status);
    }
    throw err;
  }
  prompt.onUsage?.({
    provider: manifest.id,
    model: response.model,
    requestId: (response as { _request_id?: string | null })._request_id ?? undefined,
    repair,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? undefined,
  });
  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category ?? "unspecified";
    throw new ProviderError(`llm-anthropic: refused (${category})`, undefined, false);
  }
  if (response.stop_reason === "max_tokens") {
    // The same prompt with the same limit would hit it again.
    throw new ProviderError("llm-anthropic: output hit max_tokens", undefined, false);
  }
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return undefined;
  try {
    return JSON.parse(text.text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * An error event inside a stream arrives without an HTTP status. Map its type
 * so a billing, auth or request error stays permanent instead of looking like
 * a network failure.
 */
const STREAMED_ERROR_STATUS: Record<string, number> = {
  invalid_request_error: 400,
  authentication_error: 401,
  billing_error: 402,
  permission_error: 403,
  not_found_error: 404,
  request_too_large: 413,
  rate_limit_error: 429,
  api_error: 500,
  overloaded_error: 529,
};
export function streamedErrorStatus(err: { error?: unknown; message?: string }): number | undefined {
  const body = err.error as { error?: { type?: unknown }; type?: unknown } | undefined;
  const type = body?.error?.type ?? body?.type ?? /"type":"([a-z_]+_error|request_too_large)"/.exec(err.message ?? "")?.[1];
  return typeof type === "string" ? STREAMED_ERROR_STATUS[type] : undefined;
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
