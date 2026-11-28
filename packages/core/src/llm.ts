import { z, type ZodType } from "zod";
import { ProviderError } from "./errors";
import type { Prompt, PromptImage } from "./ports";

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
  run: (user: string, repair: number) => Promise<unknown>,
  onInvalid?: (issues: string, repair: number) => void,
): Promise<T> {
  let hint: string | undefined;
  let last = "unknown error";
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = hint
      ? `${user}\n\nThe previous output failed validation: ${hint}\nReturn a value that matches the schema.`
      : user;
    const raw = await run(message, attempt);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    last = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    onInvalid?.(last, attempt);
    hint = last;
  }
  throw new Error(`output did not match schema: ${last}`);
}

/** Provider-independent bounds for image prompts (Anthropic allows 5 MB base64 per image). */
/** The API accepts up to 100 per request (2000 px per side above 20); critique sends at most 28. */
export const MAX_PROMPT_IMAGES = 32;
export const MAX_PROMPT_IMAGE_BYTES = 3_500_000;

/**
 * Check images before a paid call: count, declared type against magic bytes,
 * and size. Throws a permanent ProviderError, since a retry cannot fix it.
 */
export function validatePromptImages(provider: string, images: readonly PromptImage[] | undefined, supported: boolean): void {
  if (!images?.length) return;
  if (!supported) throw new ProviderError(`${provider}: the configured model does not accept image input`, undefined, false);
  if (images.length > MAX_PROMPT_IMAGES) throw new ProviderError(`${provider}: ${images.length} images; the limit is ${MAX_PROMPT_IMAGES}`, undefined, false);
  for (const [index, image] of images.entries()) {
    const d = image.data;
    if (d.byteLength === 0 || d.byteLength > MAX_PROMPT_IMAGE_BYTES)
      throw new ProviderError(`${provider}: image ${index} is ${d.byteLength} bytes; the limit is ${MAX_PROMPT_IMAGE_BYTES}`, undefined, false);
    const jpeg = d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff;
    const png = d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47;
    if ((image.mediaType === "image/jpeg" && !jpeg) || (image.mediaType === "image/png" && !png))
      throw new ProviderError(`${provider}: image ${index} is not a valid ${image.mediaType}`, undefined, false);
  }
}

export const USAGE_ESTIMATOR = "chars/4+images(w*h/750)@540x960:v1";

/** Labeled estimate for a response without reported usage. */
export function estimateUsage(inputChars: number, images: number, outputChars: number) {
  return {
    inputTokens: Math.ceil(inputChars / 4) + images * Math.ceil((540 * 960) / 750),
    outputTokens: Math.ceil(outputChars / 4),
    estimator: USAGE_ESTIMATOR,
  };
}
