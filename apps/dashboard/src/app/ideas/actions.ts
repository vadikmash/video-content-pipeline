"use server";

import { Domain, NewIdea } from "@vcp/core";
import { createProject, getIdea, insertIdea, listIdeas, logEvent, setIdeaStatus } from "@vcp/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { discoverIdeasLocal } from "@/lib/discover";
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
    // The pasted URL is a citation, not the post the idea was copied from.
    // Setting it as sourceUrl makes research reject every hand-added idea.
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

/** Pull candidate facts from IdeaSource (fake-source in M0). */
export async function discoverIdeas(): Promise<void> {
  const result = await discoverIdeasLocal({ listIdeas, insertIdea });
  await logEvent(null, "ideas.discovered", {
    providerId: result.providerId,
    added: result.added,
    skipped: result.skipped,
    titles: result.titles,
    via: "dashboard",
  });
  revalidatePath("/ideas");
  redirect(`/ideas?sourced=${result.added}&skipped=${result.skipped}&via=${result.providerId}`);
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
