import { ProviderError, defineManifest, inputHash, newId, nowIso, type ImageGen, type ProviderContext } from "@vcp/core";
import { Deferred, limits, parseRetryAfter } from "@vcp/limits";
import { z } from "zod";

const responseSchema = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).min(1) });
const errorSchema = z.object({ error: z.object({ code: z.string().nullish(), message: z.string().optional() }) });

export const manifest = defineManifest({
  id: "image-openai",
  port: "ImageGen",
  env: ["OPENAI_API_KEY"],
  limits: { concurrency: 1 },
  attributionRequired: false,
  costModel: { unit: "image", approxUsd: 0 },
  description: "Generates stills with GPT Image. Set OPENAI_IMAGE_MODEL to choose the model.",
});

export function create(ctx: ProviderContext): ImageGen {
  const apiKey = ctx.env.OPENAI_API_KEY;
  const model = ctx.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
  return {
    id: manifest.id,
    async generate(prompt, opts) {
      if (!apiKey) throw new ProviderError("OPENAI_API_KEY is missing", 401);
      const width = opts.width ?? 1080;
      const height = opts.height ?? 1920;
      const size = width === height ? "1024x1024" : width > height ? "1536x1024" : "1024x1536";
      const illustrative = opts.style === "flat-illustration";
      const styledPrompt = illustrative
        ? `Create a visibly drawn flat illustration, without lettering or photography. Subject: ${prompt}`
        : [prompt, opts.style && `Visual style: ${opts.style}`].filter(Boolean).join("\n");
      const body = { model, size, prompt: styledPrompt, output_format: "png", quality: "medium", n: 1 };
      const id = opts.requestId ? inputHash({ requestId: opts.requestId, body }) : newId();
      const ref = { key: `generated/image-openai/${id}.png`, contentType: "image/png" };
      let cached: Buffer | undefined;
      if (opts.requestId) {
        try {
          cached = Buffer.from(await ctx.blob.get(ref));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }

      const bytes = cached ?? await generatePng();
      if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        bytes.toString("ascii", 12, 16) !== "IHDR" || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20)) {
        throw new ProviderError("GPT Image did not return a valid PNG", 502);
      }
      const blob = cached ? { ...ref, size: bytes.byteLength } : await ctx.blob.put(ref.key, bytes, ref.contentType);
      return {
        id,
        kind: "image",
        blob,
        provider: manifest.id,
        licence: "Generated with GPT Image",
        attribution: { text: "Image generated with GPT Image", url: "" },
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        synthetic: !illustrative,
        createdAt: nowIso(),
      };

      async function generatePng(): Promise<Buffer> {
        await limits.acquire(manifest.id);
        const response = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(180_000),
          redirect: "error",
        }).catch(() => { throw new ProviderError("GPT Image request failed"); });
        const payload: unknown = await response.json().catch(() => undefined);
        if (!response.ok) {
          const details = errorSchema.safeParse(payload);
          const error = details.success ? details.data.error : undefined;
          if (error?.code === "insufficient_quota" || error?.code === "billing_hard_limit_reached") {
            throw new ProviderError("GPT Image requires available OpenAI API credits", response.status, false);
          }
          if (response.status === 429) {
            const wait = parseRetryAfter(response.headers.get("retry-after") ?? undefined) ?? 30_000;
            await limits.trip(manifest.id, new Date(Date.now() + wait), "GPT Image rate limit reached");
            throw new Deferred(manifest.id, wait, "GPT Image rate limit reached");
          }
          throw new ProviderError(`GPT Image HTTP ${response.status}: ${error?.message ?? response.statusText}`, response.status);
        }
        const result = responseSchema.safeParse(payload);
        const image = result.success ? result.data.data[0]?.b64_json : undefined;
        if (!image) throw new ProviderError("GPT Image response is missing image data", 502);
        return Buffer.from(image, "base64");
      }
    },
  };
}
