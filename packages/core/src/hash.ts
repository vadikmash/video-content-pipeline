import { createHash } from "node:crypto";

/** Canonical JSON: object keys sorted recursively, undefined dropped. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Stable sha256 of any JSON-serialisable input; used as the stage idempotency key. */
export function inputHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
