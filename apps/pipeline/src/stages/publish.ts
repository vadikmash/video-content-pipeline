import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";

export const publish = defineStage({
  name: "publish",
  async input(ctx) {
    const up = await ctx.store.latestUpload(ctx.project.id);
    if (!up) throw new StageError("publish: no upload for project", false);
    return { uploadId: up.id, publishAt: up.publishAt ?? null };
  },
  async run(ctx, input) {
    const { ports, store, project } = ctx;
    const up = await store.getUpload(input.uploadId);
    if (!up) throw new StageError("publish: upload missing", false);

    await limits.acquire(ports.Publisher.id);
    const next = await ports.Publisher.setPrivacy(up, "public", up.publishAt);
    await store.updateUpload(next);
    await store.updateProject(project.id, { status: "published", currentStage: "publish" });
    await store.setIdeaStatus(project.ideaId, "done");
    return { artifactId: next.id, summary: { status: next.status, privacy: next.privacy, publishAt: next.publishAt ?? null } };
  },
});
