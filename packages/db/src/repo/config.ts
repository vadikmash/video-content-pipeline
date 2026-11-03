import { eq, inArray } from "drizzle-orm";
import { PipelineConfig, withDefaultGates, type GateMode, type PortName } from "@vcp/core";
import { getDb } from "../client";
import { providersConfig } from "../schema";

/**
 * Materialise the pipeline config: global rows, then per-project overrides on top.
 */
export async function loadPipelineConfig(projectId?: string): Promise<PipelineConfig> {
  const scopes = projectId ? ["global", projectId] : ["global"];
  const rows = await getDb().select().from(providersConfig).where(inArray(providersConfig.scope, scopes));

  const ports: PipelineConfig["ports"] = {};
  const gates: Record<string, GateMode> = {};
  // Apply global first, then project scope so overrides win.
  for (const scope of scopes) {
    for (const r of rows.filter((x) => x.scope === scope)) {
      if (r.kind === "port") ports[r.key] = { providerId: r.value, options: r.options };
      else if (r.kind === "gate") gates[r.key] = r.value as GateMode;
    }
  }
  return withDefaultGates(PipelineConfig.parse({ ports, gates }));
}

export async function setPortBinding(
  port: PortName,
  providerId: string,
  options: Record<string, unknown> = {},
  scope = "global",
): Promise<void> {
  await getDb()
    .insert(providersConfig)
    .values({ scope, kind: "port", key: port, value: providerId, options })
    .onConflictDoUpdate({
      target: [providersConfig.scope, providersConfig.kind, providersConfig.key],
      set: { value: providerId, options, updatedAt: new Date() },
    });
}

export async function setGateMode(gate: string, mode: GateMode, scope = "global"): Promise<void> {
  await getDb()
    .insert(providersConfig)
    .values({ scope, kind: "gate", key: gate, value: mode })
    .onConflictDoUpdate({
      target: [providersConfig.scope, providersConfig.kind, providersConfig.key],
      set: { value: mode, updatedAt: new Date() },
    });
}

export async function listConfigRows(scope = "global") {
  return getDb().select().from(providersConfig).where(eq(providersConfig.scope, scope));
}
