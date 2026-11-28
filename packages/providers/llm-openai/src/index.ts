import {
  defineManifest,
  parseWithOneRetry,
  promptText,
  strictJsonSchema,
  validatePromptImages,
  type Prompt,
  type ProviderContext,
  type TextModel,
  ProviderError,
} from "@vcp/core";

export const manifest = defineManifest({
  id: "llm-openai",
  port: "TextModel",
  env: ["OPENAI_API_KEY", "OPENAI_MODEL"],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "token", approxUsd: 0 },
  description: "OpenAI Chat Completions with strict json_schema. Model id is OPENAI_MODEL or options.model (default gpt-4.1).",
});

const DEFAULT_MODEL = "gpt-4.1";

/** GPT-4o/4.1/5 and the o-series reasoning models take image input; 3.5 and base gpt-4 do not. */
export function supportsImages(model: string): boolean {
  return /^(gpt-4o|gpt-4\.1|gpt-5|o[1-9]|chatgpt-4o)/.test(model);
}

/** Chat Completions user content: each label, then its image as a data URL, then the text. */
export function userContent(prompt: Pick<Prompt, "images">, text: string): string | Record<string, unknown>[] {
  if (!prompt.images?.length) return text;
  const parts: Record<string, unknown>[] = [];
  for (const image of prompt.images) {
    if (image.label) parts.push({ type: "text", text: image.label });
    parts.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${Buffer.from(image.data).toString("base64")}`, detail: "high" } });
  }
  parts.push({ type: "text", text });
  return parts;
}

export function create(ctx: ProviderContext): TextModel {
  const apiKey = ctx.env.OPENAI_API_KEY;
  const model = stringOpt(ctx.options.model) ?? ctx.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  return {
    id: manifest.id,
    capabilities: { images: supportsImages(model), model },
    async generate(schema, prompt) {
      if (!apiKey) throw new ProviderError("llm-openai: OPENAI_API_KEY is not set", undefined, false);
      validatePromptImages(manifest.id, prompt.images, supportsImages(model));
      const jsonSchema = strictJsonSchema(schema);
      const { system, user } = promptText(prompt);
      return parseWithOneRetry(schema, user, (message, repair) => complete(apiKey, model, jsonSchema, prompt, system, message, repair), prompt.onInvalidOutput);
    },
  };
}

async function complete(
  apiKey: string,
  model: string,
  jsonSchema: Record<string, unknown>,
  prompt: Prompt,
  system: string,
  user: string,
  repair: number,
): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    signal: prompt.signal ? AbortSignal.any([prompt.signal, AbortSignal.timeout(180_000)]) : AbortSignal.timeout(180_000),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent(prompt, user) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: prompt.kind, strict: true, schema: jsonSchema },
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    id?: string;
    model?: string;
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
  };
  if (!res.ok) {
    throw new ProviderError(`llm-openai: ${res.status} ${body.error?.message ?? res.statusText}`, res.status);
  }
  prompt.onUsage?.({
    provider: manifest.id,
    model: body.model ?? model,
    requestId: res.headers.get("x-request-id") ?? body.id,
    repair,
    inputTokens: body.usage?.prompt_tokens,
    outputTokens: body.usage?.completion_tokens,
    cacheReadTokens: body.usage?.prompt_tokens_details?.cached_tokens,
  });
  const content = body.choices?.[0]?.message?.content;
  if (!content) return undefined;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
