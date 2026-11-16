import { setTimeout as delay } from "node:timers/promises";
import { ProviderError, defineManifest, inputHash, newId, nowIso, type BlobRef, type ImageGen, type ProviderContext } from "@vcp/core";
import { Deferred, limits, parseRetryAfter } from "@vcp/limits";
import { z } from "zod";

const endpoint = "https://api.bfl.ai/v1/flux-2-klein-4b";
const jobSchema = z.object({ polling_url: z.url() });
const receiptSchema = jobSchema.extend({ submittedAt: z.number() });
const resultSchema = z.object({
  status: z.string(),
  result: z.object({ sample: z.url() }).nullish(),
});

export const manifest = defineManifest({
  id: "image-flux",
  port: "ImageGen",
  env: ["BFL_API_KEY"],
  limits: { concurrency: 1 },
  attributionRequired: false,
  costModel: { unit: "image", approxUsd: 0.03 },
  description: "Generates a still with Black Forest Labs FLUX.2 [klein] 4B.",
});

function pollingUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^api(?:\.[a-z]+)?\.bfl\.ai$/.test(url.hostname) || url.port || url.username || url.password) {
    throw new ProviderError("FLUX returned an invalid polling URL", 502);
  }
  return url;
}

async function request(url: URL | string, init: RequestInit, operation: string): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) })
    .catch(() => { throw new ProviderError(`FLUX ${operation} request failed`); });
  if (response.status === 429) {
    const wait = parseRetryAfter(response.headers.get("retry-after") ?? undefined) ?? 30_000;
    await limits.trip(manifest.id, new Date(Date.now() + wait), "FLUX rate limit reached");
    throw new Deferred(manifest.id, wait, "FLUX rate limit reached");
  }
  if (!response.ok) throw new ProviderError(`FLUX ${operation} failed (HTTP ${response.status})`, response.status);
  return response;
}

export function create(ctx: ProviderContext): ImageGen {
  const apiKey = ctx.env.BFL_API_KEY;
  async function read(ref: BlobRef): Promise<Buffer | undefined> {
    try {
      return Buffer.from(await ctx.blob.get(ref));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return {
    id: manifest.id,
    async generate(prompt, opts) {
      if (!apiKey) throw new ProviderError("BFL_API_KEY is missing", 401);
      const width = Math.round((opts.width ?? 1080) / 16) * 16;
      const height = Math.round((opts.height ?? 1920) / 16) * 16;
      if (!Number.isFinite(width * height) || width < 64 || height < 64 || width * height > 4_000_000) {
        throw new ProviderError("Image dimensions are outside the FLUX limits", 400);
      }
      const headers = { "x-key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
      const illustrative = opts.style === "flat-illustration";
      const composedPrompt = illustrative
        ? `Flat vector-style illustration, visibly drawn, no photography or text. Subject: ${prompt}`
        : [prompt, opts.style && `Visual style: ${opts.style}`].filter(Boolean).join("\n");
      const id = opts.requestId
        ? inputHash({ endpoint, requestId: opts.requestId, prompt: composedPrompt, width, height })
        : newId();
      const ref = { key: `generated/image-flux/${id}.png`, contentType: "image/png" };
      const existing = opts.requestId ? await read(ref) : undefined;
      const bytes = existing ?? await generateImage();
      if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        bytes.readUInt32BE(16) === 0 || bytes.readUInt32BE(20) === 0) {
        throw new ProviderError("FLUX did not return a valid PNG image", 502);
      }
      const blob = existing ? { ...ref, size: existing.byteLength } : await ctx.blob.put(ref.key, bytes, ref.contentType);
      return {
        id,
        kind: "image",
        blob,
        provider: manifest.id,
        licence: "Generated with FLUX",
        attribution: { text: "Image generated with FLUX", url: "" },
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        synthetic: !illustrative,
        createdAt: nowIso(),
      };

      async function generateImage(): Promise<Buffer> {
        const receiptRef = { key: `jobs/image-flux/${id}.json`, contentType: "application/json" };
        const saved = opts.requestId ? await read(receiptRef) : undefined;
        const receipt = saved ? receiptSchema.parse(JSON.parse(saved.toString())) : undefined;
        let url: URL;
        if (receipt && Date.now() - receipt.submittedAt < 10 * 60_000) {
          url = pollingUrl(receipt.polling_url);
        } else {
          await limits.acquire(manifest.id);
          const submitted = await request(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ prompt: composedPrompt, width, height, output_format: "png" }),
          }, "submission");
          url = pollingUrl(jobSchema.parse(await submitted.json()).polling_url);
          if (opts.requestId) {
            const record = Buffer.from(JSON.stringify({ polling_url: url.href, submittedAt: Date.now() }));
            await ctx.blob.put(receiptRef.key, record, receiptRef.contentType);
          }
        }

        for (let attempt = 0; attempt < 60; attempt++) {
          if (attempt > 0) await delay(1_000);
          await limits.acquire(manifest.id, { cost: 0 });
          const response = await request(url, { headers }, "status check");
          const result = resultSchema.parse(await response.json());
          if (result.status === "Pending" || result.status === "Processing") continue;
          if (result.status !== "Ready" || !result.result) {
            throw new ProviderError(`FLUX generation ended with status ${result.status}`, 422);
          }
          const sample = new URL(result.result.sample);
          const trustedDelivery = /^delivery(?:\.[a-z]+)?\.bfl\.ai$|^bfldelivery[a-z0-9]*\.blob\.core\.windows\.net$/.test(sample.hostname);
          if (!trustedDelivery || sample.protocol !== "https:" || sample.port || sample.username || sample.password) {
            throw new ProviderError("FLUX returned an invalid image URL", 502);
          }
          const image = await request(sample, {}, "image download");
          return Buffer.from(await image.arrayBuffer());
        }
        throw new ProviderError("FLUX generation timed out", 408);
      }
    },
  };
}
