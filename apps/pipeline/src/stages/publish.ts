import { limits } from "@vcp/limits";
import { StageError, defineStage } from "./context";
import { currentUpload, publishTarget } from "./destination";

export const publish = defineStage({
  name: "publish",
  async input(ctx) {
    const channelId = ctx.project.channelId;
    const { upload: up } = await currentUpload(ctx.store, ctx.project.id, channelId);
    if (!up) {
      const any = await ctx.store.latestUpload(ctx.project.id);
      throw new StageError(
        any
          ? `publish: no upload of the latest render to ${channelId ?? "the selected destination"}; upload it there and approve again`
          : "publish: no upload for project",
        false,
      );
    }
    return {
      uploadId: up.id,
      channelId: up.channelId ?? channelId ?? null,
      publishAt: up.publishAt ?? null,
      publishTimeZone: up.publishTimeZone ?? null,
    };
  },
  async run(ctx, input) {
    const { ports, store, project } = ctx;
    const up = await store.getUpload(input.uploadId);
    if (!up) throw new StageError("publish: upload missing", false);
    const target = await publishTarget(ctx, input.channelId ?? undefined);

    await limits.acquire(ports.Publisher.id);
    const next = await ports.Publisher.setPrivacy(up, "public", up.publishAt, target);
    // A pre-channel upload is bound to the destination once the publisher has checked the video is there.
    await store.updateUpload({ ...next, channelId: next.channelId ?? up.channelId ?? input.channelId ?? undefined });

    if (next.status === "published") {
      await store.updateProject(project.id, { status: "published", currentStage: "publish" });
      await store.setIdeaStatus(project.ideaId, "done");
    } else if (next.status === "scheduled") {
      // Not published yet: a status read after publishAt confirms it (see confirmRelease).
      await store.updateProject(project.id, { status: "waiting", currentStage: "publish" });
      await store.logEvent(project.id, "upload.scheduled", {
        uploadId: next.id,
        publishAt: next.publishAt ?? null,
        publishTimeZone: next.publishTimeZone ?? null,
      });
    }
    return {
      artifactId: next.id,
      summary: {
        status: next.status,
        privacy: next.privacy,
        channelId: next.channelId ?? null,
        publishAt: next.publishAt ?? null,
        publishTimeZone: next.publishTimeZone ?? null,
      },
    };
  },
});
