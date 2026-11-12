/**
 * Error a provider throws for a failed remote call. `retriable` decides
 * whether the pipeline tries again: timeouts, rate limits and server errors
 * can succeed later; other 4xx (bad key, missing scope, bad request) cannot.
 */
export class ProviderError extends Error {
  readonly retriable: boolean;

  constructor(
    message: string,
    readonly status?: number,
    retriable?: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
    this.retriable = retriable ?? isRetriableStatus(status);
  }
}

/** No status (network error) counts as retriable. */
export function isRetriableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}

/**
 * True when an error says retrying cannot help. Duck-typed on `retriable`
 * so it works for StageError, ProviderError, and copies of either loaded
 * from another module instance.
 */
export function isPermanentError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { retriable?: unknown }).retriable === false;
}
