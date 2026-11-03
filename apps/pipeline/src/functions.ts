import { GATES, GATE_EVENTS, STAGES, isGate, previousStage, type GateName, type StageName } from "@vcp/core";
import { Deferred } from "@vcp/limits";
import { registry } from "@vcp/providers";
import { NonRetriableError, RetryAfterError } from "inngest";
import { events, inngest } from "./inngest";
import {
  StageError,
  WORK_STAGES,
  approveGate,
  failProject,
  loadGateMode,
  markGateTimedOut,
  markGateWaiting,
  rejectProject,
  runStage,
  type StageDef,
} from "./stages/index";
import { dbStore } from "./store/db";

const deps = { store: dbStore, registry };

/** Trigger for the stage that follows `stage` in the pipeline. */
function triggerAfter(stage: StageName) {
  const prev = previousStage(stage);
  if (!prev) return events.ideaSelected;
  return { event: events.stageCompleted, if: `event.data.stage == "${prev}"` };
}

const cancelOnReject = [{ event: events.projectRejected, match: "data.projectId" }];

function mapError(err: unknown): never {
  if (err instanceof Deferred) throw new RetryAfterError(err.message, err.retryAfterMs);
  if (err instanceof StageError && !err.retriable) throw new NonRetriableError(err.message, { cause: err });
  throw err;
}

// ---------------------------------------------------------------------------
// Work stages
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stageFunction(def: StageDef<any>) {
  return inngest.createFunction(
    {
      id: `stage-${def.name}`,
      name: `Stage: ${def.name}`,
      triggers: [triggerAfter(def.name)],
      cancelOn: cancelOnReject,
      retries: 3,
      concurrency: def.name === "render" ? { limit: 1 } : { limit: 4 },
      onFailure: async ({ event }) => {
        const original = event.data.event as { data?: { projectId?: string } };
        const projectId = original?.data?.projectId;
        if (projectId) await failProject(projectId, def.name, event.data.error.message, dbStore);
      },
    },
    async ({ event, step, runId, attempt }) => {
      const { projectId } = event.data;
      const result = await step.run(`run-${def.name}`, async () => {
        try {
          return await runStage(def, projectId, deps, { runId, attempt: attempt + 1 });
        } catch (err) {
          mapError(err);
        }
      });
      await step.sendEvent("stage-completed", {
        name: "stage.completed",
        data: { projectId, stage: def.name, artifactId: result.artifactId },
      });
      return result;
    },
  );
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

function gateFunction(gate: GateName) {
  const approveEvent = {
    "approve-script": events.scriptApproved,
    "approve-video": events.renderApproved,
    "approve-publish": events.uploadPublish,
  }[gate];

  return inngest.createFunction(
    {
      id: `gate-${gate}`,
      name: `Gate: ${gate}`,
      triggers: [triggerAfter(gate)],
      cancelOn: cancelOnReject,
      retries: 2,
    },
    async ({ event, step, runId }) => {
      const { projectId } = event.data;
      const mode = await step.run("gate-mode", () => loadGateMode(projectId, gate, dbStore));

      if (mode === "auto") {
        await step.run("auto-approve", () => approveGate(projectId, gate, "auto", {}, dbStore));
      } else {
        await step.run("mark-waiting", () => markGateWaiting(projectId, gate, dbStore, runId));
        const approval = await step.waitForEvent("wait-for-approval", {
          event: approveEvent,
          match: "data.projectId",
          timeout: "30d",
        });
        if (!approval) {
          await step.run("timed-out", () => markGateTimedOut(projectId, gate, dbStore));
          return { gate, outcome: "timeout" };
        }
        await step.run("record-approval", () =>
          approveGate(projectId, gate, "user", approval.data as Record<string, unknown>, dbStore),
        );
      }

      await step.sendEvent("stage-completed", { name: "stage.completed", data: { projectId, stage: gate } });
      return { gate, outcome: mode };
    },
  );
}

// ---------------------------------------------------------------------------
// Rejection
// ---------------------------------------------------------------------------

export const onProjectRejected = inngest.createFunction(
  { id: "project-rejected", name: "Project rejected", triggers: [events.projectRejected], retries: 2 },
  async ({ event, step }) => {
    const { projectId, stage, reason } = event.data;
    await step.run("record", () => rejectProject(projectId, stage, reason, dbStore));
    return { projectId, stage };
  },
);

// ---------------------------------------------------------------------------

const workByName = new Map(WORK_STAGES.map((s) => [s.name, s]));

export const functions = [
  ...STAGES.map((name) => (isGate(name) ? gateFunction(name) : stageFunction(workByName.get(name)!))),
  onProjectRejected,
];

export { GATES, GATE_EVENTS };
