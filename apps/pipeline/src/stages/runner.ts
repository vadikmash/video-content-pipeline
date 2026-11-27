import {
  GATE_EVENTS,
  STAGE_PORTS,
  gateMode,
  inputHash,
  previousStage,
  type GateMode,
  type GateName,
  type ProviderRegistry,
} from "@vcp/core";
import type { Store } from "../store/types";
import { StageError, loadStageCtx, providerIdsFor, type StageDef, type StageResult } from "./context";
import { currentUpload } from "./destination";

export interface RunMeta {
  runId?: string;
  attempt?: number;
}

export interface RunOutcome extends StageResult {
  skipped: boolean;
  inputHash: string;
}

/**
 * Execute one work stage with the idempotency rule from the tech plan:
 * output is keyed on (projectId, stage, inputHash); a re-run with the same
 * input and the same providers is a no-op that returns the existing artifact.
 */
export async function runStage<I>(
  def: StageDef<I>,
  projectId: string,
  deps: { store: Store; registry: ProviderRegistry },
  meta: RunMeta = {},
): Promise<RunOutcome> {
  const { store } = deps;
  const ctx = await loadStageCtx(projectId, store, deps.registry);
  if (ctx.project.status === "rejected") throw new StageError(`project ${projectId} was rejected`, false);

  const input = await def.input(ctx);
  const providerIds = providerIdsFor(ctx.config, STAGE_PORTS[def.name]);
  const hash = inputHash({ stage: def.name, input, providerIds });

  const existing = await store.getStage(projectId, def.name);
  if (existing?.status === "done" && existing.inputHash === hash && existing.artifactId) {
    return { artifactId: existing.artifactId, skipped: true, inputHash: hash };
  }

  await store.upsertStage(projectId, def.name, {
    status: "running",
    inputHash: hash,
    providerId: providerIds[0],
    startedAt: new Date(),
    finishedAt: null,
    attempt: meta.attempt ?? (existing?.attempt ?? 0) + 1,
    runId: meta.runId,
    error: null,
  });
  await store.updateProject(projectId, { status: "active", currentStage: def.name });

  try {
    const result = await def.run(ctx, input);
    await store.upsertStage(projectId, def.name, { status: "done", finishedAt: new Date(), artifactId: result.artifactId });
    return { ...result, skipped: false, inputHash: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.upsertStage(projectId, def.name, { status: "failed", finishedAt: new Date(), error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

export async function loadGateMode(projectId: string, gate: GateName, store: Store): Promise<GateMode> {
  const config = await store.loadPipelineConfig(projectId);
  return gateMode(config, gate);
}

export async function markGateWaiting(projectId: string, gate: GateName, store: Store, runId?: string): Promise<void> {
  await store.upsertStage(projectId, gate, { status: "waiting", startedAt: new Date(), finishedAt: null, error: null, artifactId: null, runId });
  await store.updateProject(projectId, { status: "waiting", currentStage: gate });
}

/** Record an approval (auto or human) and apply its side effects. */
export async function approveGate(
  projectId: string,
  gate: GateName,
  by: "user" | "auto",
  data: Record<string, unknown>,
  store: Store,
): Promise<void> {
  if (gate === "approve-script") {
    const scriptId = typeof data.scriptId === "string" ? data.scriptId : (await store.latestScript(projectId))?.id;
    if (scriptId) await store.markScriptReviewed(scriptId, by);
  }
  if (gate === "approve-publish") {
    const project = await store.getProject(projectId);
    const { upload: up } = await currentUpload(store, projectId, project?.channelId);
    if (up && (data.uploadId === undefined || data.uploadId === up.id)) {
      const publishAt = typeof data.publishAt === "string" ? data.publishAt : undefined;
      const publishTimeZone = publishAt && typeof data.publishTimeZone === "string" ? data.publishTimeZone : undefined;
      // Always rewrite both: an approval without a time publishes now, even if an earlier one scheduled.
      await store.updateUpload({ ...up, publishAt, publishTimeZone });
    }
  }
  await store.upsertStage(projectId, gate, {
    status: "done",
    startedAt: new Date(),
    finishedAt: new Date(),
    providerId: by,
    error: null,
  });
  await store.updateProject(projectId, { status: "active", currentStage: gate });
  await store.logEvent(projectId, GATE_EVENTS[gate], { by, ...data });
}

/**
 * An approval to publish counts only for the upload the gate currently shows: the latest
 * render's upload to the project's saved destination. An approval for any other upload (the
 * destination changed after the reviewer loaded the page) is stale and ignored.
 */
export async function isCurrentPublishApproval(projectId: string, uploadId: string, store: Store): Promise<boolean> {
  const project = await store.getProject(projectId);
  if (!project) return false;
  const { upload } = await currentUpload(store, projectId, project.channelId);
  return upload?.id === uploadId;
}

export async function markGateTimedOut(projectId: string, gate: GateName, store: Store): Promise<void> {
  await store.upsertStage(projectId, gate, { status: "failed", finishedAt: new Date(), error: "gate timed out" });
  await store.updateProject(projectId, { status: "failed", currentStage: gate });
}

export async function rejectProject(projectId: string, stage: string, reason: string, store: Store): Promise<void> {
  await store.upsertStage(projectId, stage, { status: "failed", finishedAt: new Date(), error: `rejected: ${reason}` });
  await store.updateProject(projectId, { status: "rejected", currentStage: stage, rejectReason: reason });
  await store.logEvent(projectId, "project.rejected", { stage, reason });
}

export async function failProject(projectId: string, stage: string, error: string, store: Store): Promise<void> {
  await store.upsertStage(projectId, stage, { status: "failed", finishedAt: new Date(), error });
  await store.updateProject(projectId, { status: "failed", currentStage: stage });
}

/** Recover both gate initialization failures and failures while recording an approval. */
export async function failGateRun(projectId: string, gate: GateName, runId: string, error: string, store: Store): Promise<void> {
  const project = await store.getProject(projectId);
  if (!project || project.status === "rejected") return;
  const row = await store.getStage(projectId, gate);
  if (project.currentStage === gate) {
    if (row?.runId && row.runId !== runId) return;
  } else {
    const previous = previousStage(gate);
    if (project.currentStage !== previous || !previous) return;
    if ((await store.getStage(projectId, previous))?.status !== "done") return;
  }
  await failProject(projectId, gate, error, store);
}
