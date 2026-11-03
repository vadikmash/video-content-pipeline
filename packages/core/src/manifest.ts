import { z } from "zod";
import type { PortName } from "./ports";

export const ProviderLimits = z.object({
  perMinute: z.number().positive().optional(),
  perDay: z.number().positive().optional(),
  perMonth: z.number().positive().optional(),
  cacheSeconds: z.number().nonnegative().optional(),
  concurrency: z.number().int().positive().optional(),
});
export type ProviderLimits = z.infer<typeof ProviderLimits>;

export const CostModel = z.object({
  unit: z.enum(["request", "character", "token", "second", "image", "video"]),
  approxUsd: z.number().nonnegative(),
});
export type CostModel = z.infer<typeof CostModel>;

export interface ProviderManifest {
  id: string;
  port: PortName;
  /** Env vars the provider reads; the dashboard shows presence, never values. */
  env: string[];
  limits: ProviderLimits;
  attributionRequired: boolean;
  costModel: CostModel;
  /** True for fake-* providers; the dashboard flags them and dry-run prefers them. */
  fake?: boolean;
  description?: string;
}

export function defineManifest<M extends ProviderManifest>(m: M): M {
  return m;
}
