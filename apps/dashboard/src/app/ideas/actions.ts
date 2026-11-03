"use server";

import { Domain, NewIdea } from "@vcp/core";
import { createProject, getIdea, insertIdea, logEvent, setIdeaStatus } from "@vcp/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEvent } from "@/lib/inngest";

const AddIdeaForm = z.object({
  title: z.string().trim().min(1),
  oneLiner: z.string().trim().min(1),
  whySurprising: z.string().trim().min(1),
  domain: Domain,
  evidenceUrl: z.string().trim().optional(),
  evidenceQuote: z.string().trim().optional(),
  opinion: z.string().optional(),
});

export async function addIdea(formData: FormData): Promise<void> {
  const raw = Object.fromEntries(formData.entries());
  const form = AddIdeaForm.parse(raw);
  const evidence = form.evidenceUrl ? [{ url: form.evidenceUrl, quote: form.evidenceQuote || form.oneLiner }] : [];
  const idea = NewIdea.parse({
    origin: "manual",
    sourceProvider: "source-manual",
    sourceUrl: form.evidenceUrl || undefined,
    title: form.title,
    oneLiner: form.oneLiner,
    whySurprising: form.whySurprising,
    domain: form.domain,
    evidence,
    opinion: form.opinion === "on",
    status: "new",
  });
  await insertIdea(idea);
  revalidatePath("/ideas");
}

export async function shortlistIdea(id: string): Promise<void> {
  await setIdeaStatus(id, "shortlisted");
  revalidatePath("/ideas");
}

export async function rejectIdea(id: string): Promise<void> {
  await setIdeaStatus(id, "rejected");
  revalidatePath("/ideas");
}

export async function restoreIdea(id: string): Promise<void> {
  await setIdeaStatus(id, "new");
  revalidatePath("/ideas");
}

/** The only place a video can start. Creates the project and emits idea.selected. */
export async function selectIdea(id: string, dryRun = false): Promise<void> {
  const idea = await getIdea(id);
  if (!idea) throw new Error("idea not found");
  if (idea.status === "selected" || idea.status === "done") throw new Error("idea already selected");

  const project = await createProject(id, { dryRun });
  await setIdeaStatus(id, "selected");
  await logEvent(project.id, "idea.selected", { ideaId: id, dryRun });
  await sendEvent("idea.selected", { projectId: project.id, ideaId: id });

  revalidatePath("/ideas");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
