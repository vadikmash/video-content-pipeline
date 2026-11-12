import { isPermanentError } from "@vcp/core";
import { Deferred } from "@vcp/limits";
import { NonRetriableError, RetryAfterError } from "inngest";

/**
 * Translate a stage error for Inngest: rate-limit deferrals retry after the
 * wait, permanent errors (StageError(retriable=false), ProviderError for a
 * 4xx such as a missing OAuth scope) fail at once, anything else retries.
 */
export function mapError(err: unknown): never {
  if (err instanceof Deferred) throw new RetryAfterError(err.message, err.retryAfterMs);
  if (isPermanentError(err)) throw new NonRetriableError(err instanceof Error ? err.message : String(err), { cause: err });
  throw err;
}
