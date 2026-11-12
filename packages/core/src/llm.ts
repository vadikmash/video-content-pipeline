import { z, type ZodType } from "zod";
import type { Prompt } from "./ports";

/**
 * JSON Schema for a provider that requires every object to be closed
 * (`additionalProperties: false`, every property required). OpenAI strict
 * mode rejects `oneOf`, `const`, and string formats, so those are rewritten.
 */
export function strictJsonSchema(schema: ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-07", reused: "inline" });
  return strictify(raw) as Record<string, unknown>;
}

const STRIP = new Set([
  "$schema",
  "format",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "pattern",
  "propertyNames",
  "default",
]);

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (STRIP.has(key)) continue;
    if (key === "const") {
      out.enum = [value];
      continue;
    }
    if (key === "oneOf") {
      out.anyOf = strictify(value);
      continue;
    }
    out[key] = strictify(value);
  }
  if (out.type === "object") {
    const props = out.properties;
    if (props && typeof props === "object" && !Array.isArray(props)) {
      out.required = Object.keys(props as Record<string, unknown>);
      out.additionalProperties = false;
    } else if (out.additionalProperties !== false) {
      out.properties = {};
      out.required = [];
      out.additionalProperties = false;
    }
  }
  return out;
}

/** System text plus the user text, with structured context appended as JSON. */
export function promptText(prompt: Prompt): { system: string; user: string } {
  const system = prompt.system?.trim() || "Return only the structured result.";
  const hasContext = prompt.context && Object.keys(prompt.context).length > 0;
  const context = hasContext ? `\n\nContext JSON:\n${JSON.stringify(prompt.context)}` : "";
  return { system, user: `${prompt.user}${context}` };
}

/**
 * Call `run` and parse with `schema`. On a schema miss, call once more with
 * the validation error appended. HTTP failures thrown by `run` are not retried.
 */
export async function parseWithOneRetry<T>(
  schema: ZodType<T>,
  user: string,
  run: (user: string) => Promise<unknown>,
): Promise<T> {
  let hint: string | undefined;
  let last = "unknown error";
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = hint
      ? `${user}\n\nThe previous output failed validation: ${hint}\nReturn a value that matches the schema.`
      : user;
    const raw = await run(message);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    last = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    hint = last;
  }
  throw new Error(`output did not match schema: ${last}`);
}
