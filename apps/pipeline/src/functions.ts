import { GATES, GATE_EVENTS, STAGES, isGate, previousStage, type GateName, type StageName } from "@vcp/core";
import { acceptVideoApproval, insertIdea, listIdeas, loadPipelineConfig, logEvent, releaseVideoReview } from "@vcp/db";
import { registry } from "@vcp/providers";
import { runDiscovery } from "@vcp/providers/discover";
import { mapError } from "./errors";
import { events, inngest } from "./inngest";
import {
  WORK_STAGES,
  approveGate,
  failProject,
  failGateRun,
  loadGateMode,
  markGateTimedOut,
  markGateWaiting,
  rejectProject,
  runStage,
  type StageDef,
} from "./stages/index";
import { dbStore } from "./store/db";
import { replaceReviewedAsset } from "./stages/replace-asset";

const deps = { store: dbStore, registry };

/** Trigger for the stage that follows `stage` in the pipeline. */
function triggerAfter(stage: StageName) {
  const prev = previousStage(stage);
  if (!prev) return events.ideaSelected;
  return { event: events.stageCompleted, if: `event.data.stage == "${prev}"` };
}

const cancelOnReject = [{ event: events.projectRejected, match: "data.projectId" }];

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
      concurrency: def.name === "render"
        ? { limit: 1, key: '"video-render"', scope: "env" }
        : def.name === "assets"
          ? { limit: 1, key: '"visual-assets"', scope: "env" }
          : { limit: 4 },
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
      onFailure: async ({ event }) => {
        const original = event.data.event as { data?: { projectId?: string } };
        const projectId = original.data?.projectId;
        if (!projectId) return;
        await failGateRun(projectId, gate, event.data.run_id, event.data.error.message, dbStore);
      },
    },
    async ({ event, step, runId }) => {
      const { projectId } = event.data;
      const mode = await step.run("gate-mode", () => loadGateMode(projectId, gate, dbStore));

      if (mode === "auto") {
        await step.run("auto-approve", () => approveGate(projectId, gate, "auto", {}, dbStore));
      } else if (gate === "approve-video") {
        await step.run("mark-waiting", () => markGateWaiting(projectId, gate, dbStore, runId));
        for (let revision = 0; ; revision++) {
          const suffix = revision === 0 ? "" : `-${revision}`;
          const approval = await step.waitForEvent(`wait-for-approval${suffix}`, {
            event: events.renderApproved, match: "data.projectId", timeout: "30d",
          });
          if (!approval) {
            await step.run("timed-out", () => markGateTimedOut(projectId, gate, dbStore));
            return { gate, outcome: "timeout" };
          }
          const accepted = await step.run(`record-approval${suffix}`, async () => {
            if (!await acceptVideoApproval(projectId, approval.data.renderId, approval.data.requestId)) return false;
            await logEvent(projectId, "render.approved", { by: "user", renderId: approval.data.renderId }).catch(() => {});
            return true;
          });
          if (accepted) break;
        }
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

export const onAssetReplace = inngest.createFunction(
  {
    id: "asset-replace",
    name: "Replace reviewed asset",
    triggers: [events.assetReplace],
    cancelOn: cancelOnReject,
    retries: 3,
    concurrency: [
      { limit: 1, key: '"video-render"', scope: "env" },
      { limit: 1, key: '"visual-assets"', scope: "env" },
    ],
    onFailure: async ({ event }) => {
      const input = event.data.event.data;
      await releaseVideoReview(input.projectId, input.requestId, event.data.error.message);
    },
  },
  async ({ event, step }) => {
    await step.run("replace-reviewed-asset", async () => {
      try {
        await replaceReviewedAsset(event.data);
      } catch (err) {
        mapError(err);
      }
    });
  },
);

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
// Discovery (manual trigger + daily cron)
// ---------------------------------------------------------------------------

async function discoverIdeasStep(limit?: number) {
  const config = await loadPipelineConfig();
  const providerId = config.ports.IdeaSource?.providerId;
  const source =
    providerId && providerId !== "source-manual"
      ? registry.instantiate("IdeaSource", providerId, {})
      : undefined;
  const result = await runDiscovery({
    listIdeas,
    insertIdea,
    providerId,
    source,
    limit,
  });
  await logEvent(null, "ideas.discovered", {
    providerId: result.providerId,
    added: result.added,
    skipped: result.skipped,
    titles: result.titles,
  });
  return result;
}

export const onIdeasDiscover = inngest.createFunction(
  {
    id: "ideas-discover",
    name: "Discover ideas",
    triggers: [events.ideasDiscover, { cron: "0 6 * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const limit = event?.data && "limit" in event.data ? event.data.limit : undefined;
    return step.run("discover", () => discoverIdeasStep(limit));
  },
);

// ---------------------------------------------------------------------------

const workByName = new Map(WORK_STAGES.map((s) => [s.name, s]));

export const functions = [
  ...STAGES.map((name) => (isGate(name) ? gateFunction(name) : stageFunction(workByName.get(name)!))),
  onProjectRejected,
  onAssetReplace,
  onIdeasDiscover,
];

export { GATES, GATE_EVENTS };
