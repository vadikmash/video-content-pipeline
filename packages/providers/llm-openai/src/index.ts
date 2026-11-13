import {
  defineManifest,
  parseWithOneRetry,
  promptText,
  strictJsonSchema,
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

export function create(ctx: ProviderContext): TextModel {
  const apiKey = ctx.env.OPENAI_API_KEY;
  const model = stringOpt(ctx.options.model) ?? ctx.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  return {
    id: manifest.id,
    async generate(schema, prompt) {
      if (!apiKey) throw new ProviderError("llm-openai: OPENAI_API_KEY is not set", undefined, false);
      const jsonSchema = strictJsonSchema(schema);
      const { system, user } = promptText(prompt);
      return parseWithOneRetry(schema, user, (message) => complete(apiKey, model, jsonSchema, prompt, system, message));
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
): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: prompt.kind, strict: true, schema: jsonSchema },
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string | null } }[];
  };
  if (!res.ok) {
    throw new ProviderError(`llm-openai: ${res.status} ${body.error?.message ?? res.statusText}`, res.status);
  }
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
