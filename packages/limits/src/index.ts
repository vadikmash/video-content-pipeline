/**
 * Rate-limit ledger, circuit breaker and backoff (tech-plan section 5).
 *
 * M0: `acquire` always resolves. The call sites exist so that M2 can enforce
 * limits without touching any provider. `Deferred` is the error providers (and
 * later the ledger) throw when a request must wait for the next window; the
 * pipeline maps it to an Inngest retry.
 */

export class Deferred extends Error {
  readonly retryAfterMs: number;
  readonly providerId: string;

  constructor(providerId: string, retryAfterMs: number, reason?: string) {
    super(reason ?? `${providerId} deferred for ${Math.round(retryAfterMs / 1000)}s`);
    this.name = "Deferred";
    this.providerId = providerId;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface AcquireOptions {
  /** Units of the provider's cost model consumed by this call (requests, characters, ...). */
  cost?: number;
}

export interface Limits {
  acquire(providerId: string, opts?: AcquireOptions): Promise<void>;
  /** Record what a response told us (remaining quota, reset time). */
  observe(providerId: string, headers: Record<string, string | undefined>): Promise<void>;
  /** Open the circuit for a provider until `until`. */
  trip(providerId: string, until: Date, reason: string): Promise<void>;
}

export const limits: Limits = {
  async acquire() {
    /* M0 no-op */
  },
  async observe() {
    /* M0 no-op */
  },
  async trip() {
    /* M0 no-op */
  },
};

/** Exponential backoff with full jitter, capped. */
export function backoffMs(attempt: number, baseMs = 500, capMs = 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

/** Parse `Retry-After` (seconds or HTTP date) into milliseconds from now. */
export function parseRetryAfter(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}
