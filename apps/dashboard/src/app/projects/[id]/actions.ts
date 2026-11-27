"use server";

import { Script, isStageName, isTimeZone, newId, retryTrigger, scriptText, zonedTimeToInstant } from "@vcp/core";
import {
  findUpload,
  getChannel,
  getProject,
  getRender,
  getStage,
  getStoryboard,
  insertScript,
  latestRender,
  latestScript,
  loadPipelineConfig,
  logEvent,
  nextScriptVersion,
  releaseVideoReview,
  reserveVideoReview,
  setProjectChannel,
  updateProject,
  upsertStage,
} from "@vcp/db";
import { revalidatePath } from "next/cache";
import { currentUploadFor } from "@/lib/destination";
import { sendEvent } from "@/lib/inngest";

async function requireProject(id: string) {
  const p = await getProject(id);
  if (!p) throw new Error("project not found");
  return p;
}

/** Append a hand-edited script version while the approve-script gate is open. */
export async function saveScriptEdit(projectId: string, formData: FormData): Promise<void> {
  const project = await requireProject(projectId);
  if (project.status !== "waiting" || project.currentStage !== "approve-script") {
    throw new Error("Script can only be edited while waiting at the approve-script gate");
  }
  const current = await latestScript(projectId);
  if (!current) throw new Error("no script to edit");

  const hook = String(formData.get("hook") ?? "").trim();
  const outro = String(formData.get("outro") ?? "").trim();
  if (!hook || !outro) throw new Error("hook and outro are required");

  const beats = current.beats.map((b) => {
    const text = String(formData.get(`beat:${b.id}`) ?? "").trim();
    if (!text) throw new Error(`beat ${b.id} is empty`);
    return { ...b, text };
  });

  const draft = { hook, beats, outro, claims: current.claims, estimatedSeconds: current.estimatedSeconds };
  const words = scriptText(draft).split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.max(12, Math.round(words / 2.5));
  const version = await nextScriptVersion(projectId);
  const next = Script.parse({
    id: newId(),
    projectId,
    ideaId: current.ideaId,
    version,
    hook,
    beats,
    outro,
    claims: current.claims,
    estimatedSeconds,
    provider: "user-edit",
    createdAt: new Date().toISOString(),
  });
  await insertScript(next);
  await logEvent(projectId, "script.edited", { scriptId: next.id, version, fromVersion: current.version });
  revalidatePath(`/projects/${projectId}`);
}

export async function approveScript(projectId: string): Promise<void> {
  await requireProject(projectId);
  const script = await latestScript(projectId);
  if (!script) throw new Error("no script to approve");
  await sendEvent("script.approved", { projectId, scriptId: script.id, version: script.version });
  revalidatePath(`/projects/${projectId}`);
}

/** A real upload needs a saved destination; the fake publisher and dry runs do not. */
async function requiresChannel(projectId: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) return false;
  const providerId = (await loadPipelineConfig(projectId)).ports.Publisher?.providerId;
  return Boolean(providerId && !providerId.startsWith("fake-"));
}

/**
 * Save the project's destination. Routing defaults only pre-fill this choice; once saved it is
 * the project's own. Changing it while waiting to publish uploads the approved render to the new
 * channel (a new, separate record) and makes approvals for the old upload stale.
 */
export async function chooseChannel(projectId: string, formData: FormData): Promise<void> {
  const project = await requireProject(projectId);
  if (project.status === "published" || project.status === "rejected") throw new Error("The destination of a finished project cannot change");
  if (project.currentStage === "publish") throw new Error("Publishing has started; the destination cannot change");
  const channelId = String(formData.get("channelId") ?? "").trim();
  if (!channelId) throw new Error("Choose a channel");
  if (!(await getChannel(channelId))) throw new Error("That channel is not connected");
  if (project.channelId === channelId) return;

  await setProjectChannel(projectId, channelId);
  await logEvent(projectId, "project.channel", { from: project.channelId ?? null, to: channelId });
  if (project.status === "waiting" && project.currentStage === "approve-publish" && !(await findUploadForLatest(projectId, channelId))) {
    await sendEvent("upload.retarget", { projectId, channelId, requestId: newId() });
  }
  revalidatePath(`/projects/${projectId}`);
}

async function findUploadForLatest(projectId: string, channelId: string) {
  const render = await latestRender(projectId);
  return render ? findUpload(projectId, render.id, channelId) : undefined;
}

export async function approveVideo(projectId: string, renderId: string): Promise<void> {
  const project = await requireProject(projectId);
  if (!project.channelId && (await requiresChannel(projectId, project.dryRun))) {
    throw new Error("Choose a destination channel before approving the upload");
  }
  const requestId = newId();
  if (!await reserveVideoReview(projectId, renderId, requestId)) return;
  try {
    await sendEvent("render.approved", { projectId, renderId, requestId }, { id: requestId });
  } catch (err) {
    await releaseVideoReview(projectId, requestId, "Could not queue approval. Try again.");
    throw err;
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function replaceAsset(projectId: string, renderId: string, beatId: string, formData: FormData): Promise<void> {
  const render = await getRender(renderId);
  const board = render?.projectId === projectId ? await getStoryboard(render.storyboardId) : undefined;
  const previous = board?.scenes.find((scene) => scene.beatId === beatId)?.visual;
  if (previous?.kind !== "stock" && previous?.kind !== "still") throw new Error("Scene is unavailable");
  const description = String(formData.get("description") ?? "").trim();
  if (!description || description.length > (previous.kind === "stock" ? 100 : 1000)) {
    throw new Error("Enter a valid description for the replacement");
  }
  const visual = previous.kind === "stock"
    ? { ...previous, query: description }
    : { ...previous, prompt: description, style: "flat-illustration" };
  const requestId = newId();
  if (!await reserveVideoReview(projectId, renderId, requestId)) return;
  try {
    await sendEvent("asset.replace", { projectId, renderId, requestId, beatId, visual }, { id: requestId });
  } catch (err) {
    await releaseVideoReview(projectId, requestId, "Could not queue asset replacement. Try again.");
    throw err;
  }
  revalidatePath(`/projects/${projectId}`);
}

export async function publishUpload(projectId: string, formData: FormData): Promise<void> {
  const project = await requireProject(projectId);
  const upload = await currentUploadFor(projectId, project.channelId);
  if (!upload) throw new Error("No upload to the selected destination yet");
  const raw = String(formData.get("publishAt") ?? "").trim();
  let publishAt: string | undefined;
  let publishTimeZone: string | undefined;
  if (raw) {
    publishTimeZone = String(formData.get("timeZone") ?? "").trim() || "UTC";
    if (!isTimeZone(publishTimeZone)) throw new Error(`Unknown time zone "${publishTimeZone}"`);
    publishAt = zonedTimeToInstant(raw, publishTimeZone);
    if (new Date(publishAt).getTime() <= Date.now()) throw new Error("The scheduled time has already passed");
  }
  await sendEvent("upload.publish", { projectId, uploadId: upload.id, publishAt, publishTimeZone });
  revalidatePath(`/projects/${projectId}`);
}

/** Read a scheduled upload's status on the remote now, instead of waiting for the next check. */
export async function checkRelease(projectId: string, uploadId: string): Promise<void> {
  await requireProject(projectId);
  await sendEvent("upload.check", { projectId, uploadId });
  revalidatePath(`/projects/${projectId}`);
}

export async function rejectProject(projectId: string, formData: FormData): Promise<void> {
  const project = await requireProject(projectId);
  const reason = String(formData.get("reason") ?? "").trim() || "rejected in dashboard";
  const stage = project.currentStage ?? "unknown";
  await logEvent(projectId, "project.rejected.requested", { stage, reason });
  await sendEvent("project.rejected", { projectId, stage, reason });
  revalidatePath(`/projects/${projectId}`);
}

/** Re-run the stage a failed project stopped at, by re-sending the event that triggers it. */
export async function retryStage(projectId: string): Promise<void> {
  const project = await requireProject(projectId);
  const stage = project.currentStage;
  if (project.status !== "failed" || !stage || !isStageName(stage)) {
    throw new Error("Only a failed project can be retried");
  }
  const row = await getStage(projectId, stage);
  if (row?.status !== "failed") throw new Error(`stage ${stage} is not failed`);

  await upsertStage(projectId, stage, { status: "pending", error: null, finishedAt: null });
  await updateProject(projectId, { status: "active", currentStage: stage });
  await logEvent(projectId, "stage.retry", { stage, previousError: row.error ?? null, previousAttempt: row.attempt ?? null });

  const trigger = retryTrigger(stage);
  // One id per failure being retried: if this send times out after Inngest accepted it and the
  // user clicks Retry again, the second event is dropped instead of starting a second run.
  const id = `retry:${projectId}:${stage}:${row.finishedAt ?? row.attempt ?? "0"}`;
  try {
    if (trigger.event === "idea.selected") await sendEvent("idea.selected", { projectId, ideaId: project.ideaId }, { id });
    else await sendEvent("stage.completed", { projectId, stage: trigger.after }, { id });
  } catch (err) {
    // The send may have failed only on our side (a timeout after Inngest accepted the event).
    // If a run has already picked the stage up, it owns the state now: leave it alone.
    const now = await getStage(projectId, stage);
    if (now?.status !== "pending") throw err;
    // Nothing will run: put the failed state back so the Retry button stays available.
    await upsertStage(projectId, stage, {
      status: "failed",
      error: row.error ?? "retry could not be queued",
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : new Date(),
    });
    await updateProject(projectId, { status: "failed", currentStage: stage });
    await logEvent(projectId, "stage.retry.failed", { stage, error: err instanceof Error ? err.message : String(err) }).catch(
      () => {},
    );
    throw err;
  }
  revalidatePath(`/projects/${projectId}`);
}
