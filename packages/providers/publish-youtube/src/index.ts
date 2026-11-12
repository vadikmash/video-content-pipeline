import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import {
  isRetriableStatus,
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
  [field: string]: unknown;
}

/** Fields videos.list returns in `status` that videos.update does not accept. */
const READ_ONLY_STATUS = ["uploadStatus", "failureReason", "rejectionReason", "madeForKids"] as const;

interface YouTubeVideo {
  id?: string;
  status?: YouTubeStatus;
}

export interface VideoBody {
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
      // videos.update replaces the whole status object: start from the current one so
      // embeddable, license, publicStatsViewable and the kids flag keep their values.
      const current = await getVideo(token, upload.remoteId);
      const status = statusForUpdate(current.status ?? {}, {
        privacyStatus: wirePrivacy,
        containsSyntheticMedia: upload.containsSyntheticMedia,
        // YouTube accepts publishAt only on a private video, i.e. only when scheduling.
        publishAt: scheduled ? publishAt : undefined,
      });
      await updateStatus(token, upload.remoteId, status);
      return {
        ...upload,
        privacy: wirePrivacy,
        publishAt: scheduled ? publishAt : undefined,
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
  if (!start.ok) throw youtubeError("insert session", start.status, await snippet(start));
  const location = start.headers.get("location");
  if (!location) throw new Error("publish-youtube: insert session missing Location");
  return putResumable(location, video);
}

/** Attempts per upload: each failed PUT is followed by a status probe and a resume from the confirmed offset. */
const UPLOAD_ATTEMPTS = 6;

export async function putResumable(location: string, video: VideoBody, sleep = defaultSleep): Promise<YouTubeVideo> {
  let offset = 0;
  let lastError = "no attempt made";
  // After a failed PUT the server may hold more bytes than we think: confirm the offset
  // with a status probe before sending again, never resend from a guessed offset.
  let needsProbe = false;
  for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(Math.min(8000, 500 * 2 ** (attempt - 1)));

    if (needsProbe) {
      const probe = await fetch(location, { method: "PUT", headers: { "content-range": `bytes */${video.size}` } }).catch(
        (err: unknown) => {
          lastError = `probe: ${err instanceof Error ? err.message : String(err)}`;
          return undefined;
        },
      );
      if (!probe) continue;
      if (probe.status === 200 || probe.status === 201) return (await probe.json()) as YouTubeVideo;
      if (probe.status === 404) throw new ProviderError("publish-youtube: upload session expired", 404, true);
      if (probe.status !== 308) {
        lastError = `probe: ${probe.status} ${await snippet(probe)}`;
        continue;
      }
      offset = nextOffset(probe.headers.get("range"));
      needsProbe = false;
    }

    const chunk = video.open(offset);
    let res: Response;
    try {
      res = await fetch(location, {
        method: "PUT",
        headers: { "content-type": "video/mp4", "content-range": `bytes ${offset}-${video.size - 1}/${video.size}` },
        body: chunk.body,
        ...(chunk.duplex ? { duplex: chunk.duplex } : {}),
      } as RequestInit);
    } catch (err) {
      // Dropped connection: ask the session how much arrived instead of starting a new insert.
      lastError = err instanceof Error ? err.message : String(err);
      needsProbe = true;
      continue;
    }
    if (res.status === 200 || res.status === 201) return (await res.json()) as YouTubeVideo;
    if (res.status === 308) {
      offset = nextOffset(res.headers.get("range"));
      continue;
    }
    const body = await snippet(res);
    lastError = `${res.status} ${body}`;
    if (res.status === 404) throw new ProviderError("publish-youtube: upload session expired", 404, true);
    const error = youtubeError("upload", res.status, body);
    if (!error.retriable) throw error;
    needsProbe = true;
  }
  throw new ProviderError(`publish-youtube: upload failed after ${UPLOAD_ATTEMPTS} attempts: ${lastError}`);
}

/** Next byte to send after a 308. No Range header means the server holds nothing yet. */
export function nextOffset(range: string | null): number {
  const match = range?.match(/(\d+)$/);
  return match ? Number(match[1]) + 1 : 0;
}

/** 403 is usually permanent, but YouTube also uses it for short-term rate limits. */
export function youtubeError(context: string, status: number, body: string): ProviderError {
  const rateLimited = status === 403 && /"reason":\s*"(rateLimitExceeded|userRateLimitExceeded)"/.test(body);
  return new ProviderError(`publish-youtube: ${context} ${status} ${body}`, status, rateLimited ? true : undefined);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateStatus(token: string, id: string, status: YouTubeStatus): Promise<void> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw youtubeError("update", res.status, await snippet(res));
}

async function getVideo(token: string, id: string): Promise<YouTubeVideo> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "status");
  url.searchParams.set("id", id);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw youtubeError("status", res.status, await snippet(res));
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
  if (!value) throw new ProviderError(`publish-youtube: ${key} is not set`, undefined, false);
  return value;
}

/** Current status minus read-only fields, with our changes applied; publishAt removed unless given. */
export function statusForUpdate(current: YouTubeStatus, changes: YouTubeStatus): YouTubeStatus {
  const next: YouTubeStatus = { ...current };
  for (const field of READ_ONLY_STATUS) delete next[field];
  delete next.publishAt;
  for (const [key, value] of Object.entries(changes)) if (value !== undefined) next[key] = value;
  return next;
}

function stringOpt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function snippet(res: Response): Promise<string> {
  return (await res.text()).slice(0, 500);
}
