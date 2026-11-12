import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import {
  defineManifest,
  newId,
  nowIso,
  type BlobStore,
  type Privacy,
  type ProviderContext,
  type Publisher,
  type Render,
  type Upload,
  type UploadMeta,
  ProviderError,
} from "@vcp/core";

export const manifest = defineManifest({
  id: "publish-youtube",
  port: "Publisher",
  env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
  limits: { perDay: 100 },
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  description: "YouTube Data API resumable videos.insert. Uploads are always private; setPrivacy publishes or schedules.",
});

interface YouTubeStatus {
  privacyStatus?: Privacy;
  publishAt?: string;
  containsSyntheticMedia?: boolean;
  uploadStatus?: string;
}

interface YouTubeVideo {
  id?: string;
  status?: YouTubeStatus;
}

interface VideoBody {
  size: number;
  open: (start: number) => { body: BodyInit; duplex?: "half" };
}

export function create(ctx: ProviderContext): Publisher {
  const env = ctx.env;
  const categoryId = stringOpt(ctx.options.categoryId) ?? env.YOUTUBE_CATEGORY_ID ?? "27";
  let cached: { value: string; expiresAt: number } | undefined;

  async function accessToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.value;
    const clientId = requireEnv(env, "YOUTUBE_CLIENT_ID");
    const clientSecret = requireEnv(env, "YOUTUBE_CLIENT_SECRET");
    const refreshToken = requireEnv(env, "YOUTUBE_REFRESH_TOKEN");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !json.access_token) {
      throw new ProviderError(`publish-youtube: oauth ${res.status} ${json.error_description ?? "no access token"}`, res.status);
    }
    cached = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  return {
    id: manifest.id,
    async upload(render, meta, privacy) {
      if (privacy !== "private") {
        throw new Error("publish-youtube: upload privacy must be private; publishing is a separate call");
      }
      const token = await accessToken();
      const video = await openVideo(ctx.blob, render);
      const inserted = await resumableInsert(token, video, meta, categoryId);
      if (!inserted.id) throw new Error("publish-youtube: insert response had no video id");
      const now = nowIso();
      const upload: Upload = {
        id: newId(),
        projectId: render.projectId,
        renderId: render.id,
        provider: manifest.id,
        remoteId: inserted.id,
        remoteUrl: watchUrl(inserted.id),
        privacy: "private",
        containsSyntheticMedia: meta.containsSyntheticMedia,
        status: "uploaded",
        meta,
        createdAt: now,
        updatedAt: now,
      };
      return upload;
    },

    async setPrivacy(upload, privacy, publishAt) {
      const token = await accessToken();
      const scheduled = Boolean(publishAt && new Date(publishAt).getTime() > Date.now());
      const wirePrivacy: Privacy = scheduled ? "private" : privacy;
      const status: YouTubeStatus = {
        privacyStatus: wirePrivacy,
        containsSyntheticMedia: upload.containsSyntheticMedia,
      };
      if (publishAt) status.publishAt = publishAt;
      await updateStatus(token, upload.remoteId, status);
      return {
        ...upload,
        privacy: wirePrivacy,
        publishAt,
        status: scheduled ? "scheduled" : privacy === "public" ? "published" : "uploaded",
        updatedAt: nowIso(),
      };
    },

    async status(upload) {
      const token = await accessToken();
      const video = await getVideo(token, upload.remoteId);
      const privacy = video.status?.privacyStatus ?? upload.privacy;
      const publishAt = video.status?.publishAt ?? upload.publishAt;
      const scheduled = Boolean(publishAt && new Date(publishAt).getTime() > Date.now());
      return {
        ...upload,
        privacy,
        publishAt,
        containsSyntheticMedia: video.status?.containsSyntheticMedia ?? upload.containsSyntheticMedia,
        status: scheduled ? "scheduled" : privacy === "public" ? "published" : "uploaded",
        updatedAt: nowIso(),
      };
    },
  };
}

async function resumableInsert(token: string, video: VideoBody, meta: UploadMeta, categoryId: string): Promise<YouTubeVideo> {
  if (video.size <= 0) throw new Error("publish-youtube: render file is empty");
  const metadata = {
    snippet: {
      title: meta.title.slice(0, 100),
      description: meta.description.slice(0, 5000),
      tags: meta.tags.slice(0, 30).map((tag) => tag.slice(0, 100)),
      categoryId,
    },
    status: {
      privacyStatus: "private",
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: meta.containsSyntheticMedia,
    },
  };
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4",
      "x-upload-content-length": String(video.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) throw new ProviderError(`publish-youtube: insert session ${start.status} ${await snippet(start)}`, start.status);
  const location = start.headers.get("location");
  if (!location) throw new Error("publish-youtube: insert session missing Location");
  return putResumable(location, video);
}

async function putResumable(location: string, video: VideoBody): Promise<YouTubeVideo> {
  let offset = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const chunk = video.open(offset);
    const headers: Record<string, string> = {
      "content-type": "video/mp4",
      "content-range": `bytes ${offset}-${video.size - 1}/${video.size}`,
    };
    const res = await fetch(location, {
      method: "PUT",
      headers,
      body: chunk.body,
      ...(chunk.duplex ? { duplex: chunk.duplex } : {}),
    } as RequestInit);
    if (res.status === 200 || res.status === 201) return (await res.json()) as YouTubeVideo;
    if (res.status === 308) {
      offset = nextOffset(res.headers.get("range"), offset);
      continue;
    }
    const probe = await fetch(location, {
      method: "PUT",
      headers: { "content-range": `bytes */${video.size}` },
    });
    if (probe.status === 200 || probe.status === 201) return (await probe.json()) as YouTubeVideo;
    if (probe.status === 308) {
      offset = nextOffset(probe.headers.get("range"), offset);
      continue;
    }
    throw new ProviderError(`publish-youtube: upload ${res.status} ${await snippet(res)}`, res.status);
  }
  throw new Error("publish-youtube: upload retries exhausted");
}

function nextOffset(range: string | null, current: number): number {
  const match = range?.match(/(\d+)$/);
  return match ? Number(match[1]) + 1 : current;
}

async function updateStatus(token: string, id: string, status: YouTubeStatus): Promise<void> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new ProviderError(`publish-youtube: update ${res.status} ${await snippet(res)}`, res.status);
}

async function getVideo(token: string, id: string): Promise<YouTubeVideo> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "status");
  url.searchParams.set("id", id);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ProviderError(`publish-youtube: status ${res.status} ${await snippet(res)}`, res.status);
  const json = (await res.json()) as { items?: YouTubeVideo[] };
  const item = json.items?.[0];
  if (!item) throw new ProviderError(`publish-youtube: video ${id} not found`, 404);
  return { ...item, id: item.id ?? id };
}

async function openVideo(blob: BlobStore, render: Render): Promise<VideoBody> {
  const file = blob.localPath?.(render.blob);
  if (file && existsSync(file)) {
    const size = (await stat(file)).size;
    return {
      size,
      open: (start) => ({
        body: createReadStream(file, { start, end: size - 1 }) as unknown as BodyInit,
        duplex: "half",
      }),
    };
  }
  const bytes = await blob.get(render.blob);
  return {
    size: bytes.byteLength,
      open: (start) => ({ body: bytes.subarray(start) as unknown as BodyInit }),
  };
}

function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

function requireEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function snippet(res: Response): Promise<string> {
  return (await res.text()).slice(0, 500);
}
