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
  description: "In-memory YouTube stand-in. remoteId is derived from the render id; nothing leaves the process.",
});

/** Visible to tests: every upload this process has seen, by remoteId. */
export const uploadsByRemoteId = new Map<string, Upload>();

export function remoteIdFor(renderId: string): string {
  return "fake-" + createHash("sha1").update(renderId).digest("base64url").slice(0, 11);
}

export function create(_ctx: ProviderContext): Publisher {
  return {
    id: manifest.id,
    async upload(render, meta, privacy) {
      const remoteId = remoteIdFor(render.id);
      const now = nowIso();
      const upload: Upload = {
        id: newId(),
        projectId: render.projectId,
        renderId: render.id,
        provider: manifest.id,
        remoteId,
        remoteUrl: `https://youtube.invalid/shorts/${remoteId}`,
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
      const next: Upload = {
        ...upload,
        privacy,
        publishAt,
        status: publishAt && new Date(publishAt).getTime() > Date.now() ? "scheduled" : privacy === "public" ? "published" : "uploaded",
        updatedAt: nowIso(),
      };
      uploadsByRemoteId.set(upload.remoteId, next);
      return next;
    },
    async status(upload) {
      return uploadsByRemoteId.get(upload.remoteId) ?? upload;
    },
  };
}
