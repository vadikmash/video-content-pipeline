import {
  PORT_NAMES,
  type Idea,
  type PipelineConfig,
  type PortName,
  type Project,
  type ProviderRegistry,
  type ResolvedPorts,
  type StageName,
} from "@vcp/core";
import type { Store } from "../store/types";

export interface StageCtx {
  project: Project;
  idea: Idea;
  config: PipelineConfig;
  ports: ResolvedPorts;
  store: Store;
  registry: ProviderRegistry;
}

export interface StageResult {
  artifactId: string;
  /** Small, JSON-safe summary shown in the dashboard and returned by step.run. */
  summary?: Record<string, unknown>;
}

export interface StageDef<I = unknown> {
  name: StageName;
  /** The input the stage depends on; hashed with the bound provider ids for idempotency. */
  input(ctx: StageCtx): Promise<I>;
  run(ctx: StageCtx, input: I): Promise<StageResult>;
}

export function defineStage<I>(def: StageDef<I>): StageDef<I> {
  return def;
}

export class StageError extends Error {
  constructor(
    message: string,
    readonly retriable = true,
  ) {
    super(message);
    this.name = "StageError";
  }
}

/** Ports that are not fakes are swapped for a fake of the same port on dry runs. */
export function applyDryRun(config: PipelineConfig, registry: ProviderRegistry): PipelineConfig {
  const ports = { ...config.ports };
  for (const port of PORT_NAMES) {
    if (port === "BlobStore" || port === "Renderer") continue;
    const binding = ports[port];
    if (!binding) continue;
    const bound = registry.manifests().find((m) => m.id === binding.providerId);
    if (bound?.fake) continue;
    const fake = registry.manifestsFor(port).find((m) => m.fake);
    if (fake) ports[port] = { providerId: fake.id, options: {} };
  }
  return { ...config, ports };
}

export async function loadStageCtx(projectId: string, store: Store, registry: ProviderRegistry): Promise<StageCtx> {
  const project = await store.getProject(projectId);
  if (!project) throw new StageError(`project ${projectId} not found`, false);
  const idea = await store.getIdea(project.ideaId);
  if (!idea) throw new StageError(`idea ${project.ideaId} not found`, false);
  let config = await store.loadPipelineConfig(projectId);
  if (project.dryRun) config = applyDryRun(config, registry);
  const ports = registry.resolveAll(config);
  return { project, idea, config, ports, store, registry };
}

/** True when the provider bound to `port` is a fake (dry runs, tests, or keys not configured). */
export function isFakeProvider(ctx: StageCtx, port: PortName): boolean {
  const id = (ctx.ports[port] as { id: string } | undefined)?.id;
  return ctx.registry.manifests().some((m) => m.id === id && m.fake === true);
}

export function providerIdsFor(config: PipelineConfig, ports: readonly PortName[]): string[] {
  return ports.map((p) => config.ports[p]?.providerId ?? "unbound");
}

export function voiceOptions(config: PipelineConfig): { voiceId: string; options: Record<string, unknown> } {
  const opts = config.ports.Speech?.options ?? {};
  return { voiceId: typeof opts.voiceId === "string" ? opts.voiceId : "default", options: opts };
}
