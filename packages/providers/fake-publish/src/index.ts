import { createHash } from "node:crypto";
import { defineManifest, newId, nowIso, type ProviderContext, type Publisher, type Upload } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-publish",
  port: "Publisher",
  env: [],
  limits: { perDay: 100 },
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  fake: true,
  description:
    "In-memory YouTube stand-in. remoteId is derived from the channel and render ids; a schedule turns public on the first status read after its time. Nothing leaves the process.",
});

/** Visible to tests: every upload this process has seen, by remoteId. */
export const uploadsByRemoteId = new Map<string, Upload>();

/** Same render to the same channel always maps to the same remote id; another channel gets another. */
export function remoteIdFor(renderId: string, channelId?: string): string {
  const seed = channelId ? `${channelId}/${renderId}` : renderId;
  return "fake-" + createHash("sha1").update(seed).digest("base64url").slice(0, 11);
}

export function create(_ctx: ProviderContext): Publisher {
  return {
    id: manifest.id,
    async upload(render, meta, privacy, target) {
      const remoteId = remoteIdFor(render.id, target?.channelId);
      const now = nowIso();
      const upload: Upload = {
        id: newId(),
        projectId: render.projectId,
        renderId: render.id,
        provider: manifest.id,
        remoteId,
        remoteUrl: `https://youtube.invalid/shorts/${remoteId}`,
        ...(target ? { channelId: target.channelId } : {}),
        privacy,
        containsSyntheticMedia: meta.containsSyntheticMedia,
        status: "uploaded",
        meta,
        createdAt: now,
        updatedAt: now,
      };
      uploadsByRemoteId.set(remoteId, upload);
      return upload;
    },
    async setPrivacy(upload, privacy, publishAt) {
      const scheduled = Boolean(publishAt && new Date(publishAt).getTime() > Date.now());
      const next: Upload = {
        ...upload,
        // Like YouTube: a scheduled video stays private until its time comes.
        privacy: scheduled ? "private" : privacy,
        publishAt: scheduled ? publishAt : undefined,
        publishTimeZone: scheduled ? upload.publishTimeZone : undefined,
        status: scheduled ? "scheduled" : privacy === "public" ? "published" : "uploaded",
        updatedAt: nowIso(),
      };
      uploadsByRemoteId.set(upload.remoteId, next);
      return next;
    },
    async status(upload) {
      const remote = uploadsByRemoteId.get(upload.remoteId);
      if (!remote) return upload;
      if (remote.status === "scheduled" && remote.publishAt && new Date(remote.publishAt).getTime() <= Date.now()) {
        const released: Upload = { ...remote, privacy: "public", status: "published", updatedAt: nowIso() };
        uploadsByRemoteId.set(upload.remoteId, released);
        return { ...upload, privacy: "public", status: "published", publishAt: remote.publishAt, updatedAt: released.updatedAt };
      }
      return { ...upload, privacy: remote.privacy, status: remote.status, publishAt: remote.publishAt, updatedAt: nowIso() };
    },
  };
}
