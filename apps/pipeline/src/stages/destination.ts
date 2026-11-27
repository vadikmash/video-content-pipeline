import type { PublishTarget, Render, Upload } from "@vcp/core";
import type { Store } from "../store/types";
import { StageError, isFakeProvider, type StageCtx } from "./context";

/**
 * The publishing target for `channelId`, from its channel profile. A real publisher needs a
 * saved channel; the fake publisher (tests, dry runs) also works without one.
 */
export async function publishTarget(ctx: StageCtx, channelId: string | undefined): Promise<PublishTarget | undefined> {
  if (!channelId) {
    if (isFakeProvider(ctx, "Publisher")) return undefined;
    throw new StageError("Choose a destination channel for this project before uploading.", false);
  }
  const profile = await ctx.store.getChannel(channelId);
  if (!profile) throw new StageError(`Channel ${channelId} is not connected. Connect it or choose another destination.`, false);
  return { channelId: profile.channelId, credentialRef: profile.credentialRef };
}

/**
 * The upload the publish gate and stage act on: the latest render's upload to the project's
 * saved destination. A pre-channel upload (no recorded channel) also counts, so it can be bound
 * to the destination once the publisher confirms the video is on that channel. An upload to any
 * other channel never counts: changing the destination makes earlier approvals stale.
 */
export async function currentUpload(store: Store, projectId: string, channelId: string | undefined): Promise<{ render?: Render; upload?: Upload }> {
  const render = await store.latestRender(projectId);
  if (!render) return {};
  const upload =
    (channelId ? await store.findUpload(projectId, render.id, channelId) : undefined) ??
    (await store.findUpload(projectId, render.id, undefined));
  return { render, upload };
}
