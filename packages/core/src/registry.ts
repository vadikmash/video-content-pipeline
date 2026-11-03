import { z } from "zod";
import type { ProviderManifest } from "./manifest";
import type { BlobStore, PortMap, PortName } from "./ports";
import { PORT_NAMES } from "./ports";
import { DEFAULT_GATE_MODES, GATES, type GateMode, type GateName } from "./stages";

// ---------------------------------------------------------------------------
// Pipeline config: the `providers_config` rows, materialised
// ---------------------------------------------------------------------------

export const PortBinding = z.object({
  providerId: z.string().min(1),
  options: z.record(z.string(), z.unknown()).default({}),
});
export type PortBinding = z.infer<typeof PortBinding>;

export const PipelineConfig = z.object({
  ports: z.record(z.string(), PortBinding),
  gates: z.record(z.string(), z.enum(["auto", "manual"])).default({}),
});
export type PipelineConfig = z.infer<typeof PipelineConfig>;

export function gateMode(config: PipelineConfig, gate: GateName): GateMode {
  return (config.gates[gate] as GateMode | undefined) ?? DEFAULT_GATE_MODES[gate];
}

export function withDefaultGates(config: PipelineConfig): PipelineConfig {
  const gates: Record<string, GateMode> = { ...DEFAULT_GATE_MODES };
  for (const g of GATES) if (config.gates[g]) gates[g] = config.gates[g] as GateMode;
  return { ...config, gates };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface ProviderContext {
  options: Record<string, unknown>;
  env: Record<string, string | undefined>;
  /** Present for every port except BlobStore itself. */
  blob: BlobStore;
}

export type ProviderFactory<P extends PortName> = (ctx: ProviderContext) => PortMap[P];

export interface ProviderEntry<P extends PortName = PortName> {
  manifest: ProviderManifest & { port: P };
  create: ProviderFactory<P>;
}

export class ProviderNotFound extends Error {
  constructor(port: PortName, providerId: string) {
    super(`No provider "${providerId}" registered for port ${port}`);
    this.name = "ProviderNotFound";
  }
}

export class ProviderRegistry {
  private readonly entries = new Map<string, ProviderEntry>();

  register<P extends PortName>(manifest: ProviderManifest & { port: P }, create: ProviderFactory<P>): this {
    if (this.entries.has(manifest.id)) throw new Error(`Provider ${manifest.id} already registered`);
    this.entries.set(manifest.id, { manifest, create } as ProviderEntry);
    return this;
  }

  manifests(): ProviderManifest[] {
    return [...this.entries.values()].map((e) => e.manifest);
  }

  manifestsFor(port: PortName): ProviderManifest[] {
    return this.manifests().filter((m) => m.port === port);
  }

  has(providerId: string): boolean {
    return this.entries.has(providerId);
  }

  /** Instantiate the provider bound to `port` in `config`. */
  resolve<P extends PortName>(port: P, config: PipelineConfig, blob?: BlobStore): PortMap[P] {
    const binding = config.ports[port];
    if (!binding) throw new Error(`pipeline config has no binding for port ${port}`);
    return this.instantiate(port, binding.providerId, binding.options, blob);
  }

  instantiate<P extends PortName>(
    port: P,
    providerId: string,
    options: Record<string, unknown> = {},
    blob?: BlobStore,
  ): PortMap[P] {
    const entry = this.entries.get(providerId);
    if (!entry || entry.manifest.port !== port) throw new ProviderNotFound(port, providerId);
    const ctx: ProviderContext = {
      options,
      env: process.env,
      // BlobStore is bootstrapped first and does not get a blob of its own.
      blob: blob ?? (undefined as unknown as BlobStore),
    };
    return (entry as ProviderEntry<P>).create(ctx);
  }

  /** Resolve every port in one go. BlobStore is created first and handed to the others. */
  resolveAll(config: PipelineConfig): ResolvedPorts {
    const blob = this.resolve("BlobStore", config);
    const out: Partial<ResolvedPorts> = { BlobStore: blob };
    for (const port of PORT_NAMES) {
      if (port === "BlobStore") continue;
      if (!config.ports[port]) continue;
      (out as Record<string, unknown>)[port] = this.resolve(port, config, blob);
    }
    return out as ResolvedPorts;
  }

  /** Env vars that are missing for the providers currently bound. */
  missingEnv(config: PipelineConfig): Record<string, string[]> {
    const missing: Record<string, string[]> = {};
    for (const binding of Object.values(config.ports)) {
      const entry = this.entries.get(binding.providerId);
      if (!entry) continue;
      const absent = entry.manifest.env.filter((k) => !process.env[k]);
      if (absent.length) missing[binding.providerId] = absent;
    }
    return missing;
  }
}

export type ResolvedPorts = { [P in PortName]: PortMap[P] };
