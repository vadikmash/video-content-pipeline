import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { quotaLedger } from "../schema";

const circuitStart = new Date(0);

export async function acquireQuota(provider: string, cost: number, perMinute?: number) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${provider}))`);
    const now = Date.now();
    const [circuit] = await tx.select().from(quotaLedger).where(and(
      eq(quotaLedger.provider, provider),
      eq(quotaLedger.windowKind, "circuit"),
    ));
    if (circuit?.resetAt && circuit.resetAt.getTime() > now) {
      return { until: circuit.resetAt, reason: circuit.reason ?? "Provider circuit is open" };
    }
    if (!cost) return;

    const duration = perMinute ? 60_000 : 86_400_000;
    const windowStart = new Date(Math.floor(now / duration) * duration);
    const resetAt = new Date(windowStart.getTime() + duration);
    const windowKind = perMinute ? "minute" : "day";
    const limit = perMinute ?? null;
    const [counter] = await tx.select().from(quotaLedger).where(and(
      eq(quotaLedger.provider, provider),
      eq(quotaLedger.windowKind, windowKind),
      eq(quotaLedger.windowStart, windowStart),
    ));
    if (limit && (counter?.used ?? 0) + cost > limit) return { until: resetAt, reason: "Provider quota reached" };
    await tx.insert(quotaLedger).values({ provider, windowKind, windowStart, used: cost, limit, resetAt })
      .onConflictDoUpdate({
        target: [quotaLedger.provider, quotaLedger.windowKind, quotaLedger.windowStart],
        set: { used: sql`${quotaLedger.used} + ${cost}`, limit, resetAt },
      });
  });
}

export async function openProviderCircuit(provider: string, resetAt: Date, reason: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${provider}))`);
    await tx.insert(quotaLedger).values({
      provider, windowKind: "circuit", windowStart: circuitStart, resetAt, reason, circuit: "open",
    }).onConflictDoUpdate({
      target: [quotaLedger.provider, quotaLedger.windowKind, quotaLedger.windowStart],
      set: { resetAt, reason, circuit: "open" },
      setWhere: sql`${quotaLedger.resetAt} <= ${resetAt}`,
    });
  });
}
