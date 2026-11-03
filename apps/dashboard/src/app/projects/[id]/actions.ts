"use server";

import { getProject, latestRender, latestScript, latestUpload, logEvent } from "@vcp/db";
import { revalidatePath } from "next/cache";
import { sendEvent } from "@/lib/inngest";

async function requireProject(id: string) {
  const p = await getProject(id);
  if (!p) throw new Error("project not found");
  return p;
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
