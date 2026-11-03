import { STAGES, isGate, type Stage } from "@vcp/core";
import { formatDuration } from "./format";
import type { RunStatus, StageRun } from "./types";

/** `approve-script` → "Approve script". */
export function stageLabel(key: string): string {
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function toRunStatus(status: Stage["status"] | undefined): RunStatus {
  // `skipped` is drawn as `done`: the pipeline has moved past the stage, and
  // `pending` would pin the strip's current marker on it.
  if (status === "skipped") return "done";
  return status ?? "pending";
}

function stageDuration(s: Stage): string | undefined {
  if (!s.startedAt) return undefined;
  const end = s.finishedAt ? new Date(s.finishedAt).getTime() : Date.now();
  return formatDuration(end - new Date(s.startedAt).getTime());
}

/** Every stage in pipeline order, merged with whatever rows have run. */
export function toStageRuns(rows: Stage[], inngestUrl?: string): StageRun[] {
  const byName = new Map(rows.map((r) => [r.name, r]));
  return STAGES.map((key) => {
    const s = byName.get(key);
    return {
      key,
      label: stageLabel(key),
      gate: isGate(key),
      status: toRunStatus(s?.status),
      provider: s?.providerId,
      duration: s ? stageDuration(s) : undefined,
      attempt: s?.attempt,
      logsHref: s?.runId && inngestUrl ? `${inngestUrl}/run?runID=${s.runId}` : undefined,
      error: s?.error,
    };
  });
}

/** Index of the stage that needs attention, or the next one after the last done. */
export function currentIndex(list: StageRun[]): number {
  let lastDone = -1;
  for (let i = 0; i < list.length; i++) {
    const st = list[i]!.status;
    if (st === "running" || st === "waiting" || st === "failed") return i;
    if (st === "done") lastDone = i;
  }
  return Math.min(lastDone + 1, list.length - 1);
}

export function isComplete(list: StageRun[]): boolean {
  return list.every((s) => s.status === "done");
}
