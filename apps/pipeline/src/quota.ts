import { acquireQuota, openProviderCircuit } from "@vcp/db";
import { Deferred, configureLimits, parseRetryAfter } from "@vcp/limits";
import { registry } from "@vcp/providers";

export function configureQuotaLedger(): void {
  const media = new Map(registry.manifests()
    .filter((manifest) => !manifest.fake && (manifest.port === "StockSearch" || manifest.port === "ImageGen"))
    .map((manifest) => [manifest.id, manifest]));

  configureLimits({
    async acquire(provider, opts) {
      const manifest = media.get(provider);
      if (!manifest) return;
      const blocked = await acquireQuota(provider, opts?.cost ?? 1, manifest.limits.perMinute);
      if (blocked) throw new Deferred(provider, Math.max(1_000, blocked.until.getTime() - Date.now()), blocked.reason);
    },
    async observe(provider, headers) {
      const reset = parseRetryAfter(headers["x-ratelimit-reset"]);
      if (media.has(provider) && headers["x-ratelimit-remaining"] === "0" && reset && reset > 0) {
        await openProviderCircuit(provider, new Date(Date.now() + reset), "Provider reported no remaining requests");
      }
    },
    async trip(provider, until, reason) {
      if (media.has(provider)) await openProviderCircuit(provider, until, reason);
    },
  });
}
