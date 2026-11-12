import {
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
  description: "Anthropic Messages with a forced tool whose input_schema is the requested zod schema. Model id is ANTHROPIC_MODEL or options.model (default claude-sonnet-4-5).",
});

const DEFAULT_MODEL = "claude-sonnet-4-5";

export function create(ctx: ProviderContext): TextModel {
  const apiKey = ctx.env.ANTHROPIC_API_KEY;
  const model = stringOpt(ctx.options.model) ?? ctx.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  return {
    id: manifest.id,
    async generate(schema, prompt) {
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
      const jsonSchema = strictJsonSchema(schema);
      const { system, user } = promptText(prompt);
      return parseWithOneRetry(schema, user, (message) => complete(apiKey, model, jsonSchema, system, message));
    },
  };
}

async function complete(
  apiKey: string,
  model: string,
  jsonSchema: Record<string, unknown>,
  system: string,
  user: string,
): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      tools: [
        {
          name: "emit",
          description: "Return the structured result.",
          input_schema: jsonSchema,
        },
      ],
      tool_choice: { type: "tool", name: "emit" },
      messages: [{ role: "user", content: user }],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    content?: { type: string; input?: unknown }[];
  };
  if (!res.ok) {
    throw new Error(`llm-anthropic: ${res.status} ${body.error?.message ?? res.statusText}`);
  }
  const tool = body.content?.find((block) => block.type === "tool_use");
  return tool?.input;
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
