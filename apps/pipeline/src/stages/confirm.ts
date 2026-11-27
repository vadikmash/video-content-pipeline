import type { ProviderRegistry, Upload } from "@vcp/core";
import { limits } from "@vcp/limits";
import type { Store } from "../store/types";
import { loadStageCtx } from "./context";
import { publishTarget } from "./destination";

/**
 * Read a scheduled upload's remote status. The project becomes published only when the
 * publisher reports the video public; until then it stays scheduled. Safe to call repeatedly.
 */
export async function confirmRelease(
  projectId: string,
  uploadId: string,
  deps: { store: Store; registry: ProviderRegistry },
): Promise<Upload["status"] | "missing"> {
  const ctx = await loadStageCtx(projectId, deps.store, deps.registry);
  const up = await deps.store.getUpload(uploadId);
  if (!up || up.projectId !== projectId) return "missing";
  if (up.status !== "scheduled") return up.status;

  const target = await publishTarget(ctx, up.channelId);
  await limits.acquire(ctx.ports.Publisher.id);
  const remote = await ctx.ports.Publisher.status(up, target);
  if (remote.status !== up.status || remote.privacy !== up.privacy) await deps.store.updateUpload({ ...up, ...remote, id: up.id });

  if (remote.status === "published") {
    await deps.store.updateProject(projectId, { status: "published", currentStage: "publish" });
    await deps.store.setIdeaStatus(ctx.project.ideaId, "done");
    await deps.store.logEvent(projectId, "upload.published", { uploadId, confirmedBy: "status-read" });
  }
  return remote.status;
}
