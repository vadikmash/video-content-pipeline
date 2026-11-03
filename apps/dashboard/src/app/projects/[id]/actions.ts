"use server";

import { Script, newId, scriptText } from "@vcp/core";
import {
  getProject,
  insertScript,
  latestRender,
  latestScript,
  latestUpload,
  logEvent,
  nextScriptVersion,
} from "@vcp/db";
import { revalidatePath } from "next/cache";
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

export async function approveVideo(projectId: string): Promise<void> {
  await requireProject(projectId);
  const render = await latestRender(projectId);
  if (!render) throw new Error("no render to approve");
  await sendEvent("render.approved", { projectId, renderId: render.id });
  revalidatePath(`/projects/${projectId}`);
}

export async function publishUpload(projectId: string, formData: FormData): Promise<void> {
  await requireProject(projectId);
  const upload = await latestUpload(projectId);
  if (!upload) throw new Error("no upload to publish");
  const raw = String(formData.get("publishAt") ?? "").trim();
  const publishAt = raw ? new Date(raw).toISOString() : undefined;
  await sendEvent("upload.publish", { projectId, uploadId: upload.id, publishAt });
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
