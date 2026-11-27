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
  type PublishTarget,
  type Render,
  type Upload,
  type UploadMeta,
  CredentialRef,
  ProviderError,
} from "@vcp/core";

export const manifest = defineManifest({
  id: "publish-youtube",
  port: "Publisher",
  // Refresh tokens are per channel: each channel profile names its own YOUTUBE_REFRESH_TOKEN* var.
  env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
  limits: { perDay: 100 },
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  description:
    "YouTube Data API resumable videos.insert to a channel profile. Verifies the authenticated channel before every write. Uploads are always private; setPrivacy publishes or schedules.",
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
  snippet?: { channelId?: string };
}

export interface VideoBody {
  size: number;
  open: (start: number) => { body: BodyInit; duplex?: "half" };
}

export function create(ctx: ProviderContext): Publisher {
  const env = ctx.env;
  const categoryId = stringOpt(ctx.options.categoryId) ?? env.YOUTUBE_CATEGORY_ID ?? "27";
  const tokens = new Map<string, { value: string; expiresAt: number }>();

  async function accessToken(target: PublishTarget): Promise<string> {
    const cached = tokens.get(target.credentialRef);
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.value;
    const token = await refreshAccessToken(env, target.credentialRef);
    tokens.set(target.credentialRef, token);
    return token.value;
  }

  /**
   * Token for `target`, after checking it authenticates as `target.channelId`. Runs before
   * every remote write; a mismatch throws before anything is sent.
   */
  async function verifiedToken(target: PublishTarget | undefined, action: string): Promise<string> {
    const t = requireTarget(target, action);
    const token = await accessToken(t);
    const actual = await authenticatedChannelId(token);
    if (actual !== t.channelId) throw channelMismatch(t, actual);
    return token;
  }

  return {
    id: manifest.id,
    async upload(render, meta, privacy, target) {
      if (privacy !== "private") {
        throw new Error("publish-youtube: upload privacy must be private; publishing is a separate call");
      }
      const token = await verifiedToken(target, "upload");
      const channelId = target!.channelId;
      const video = await openVideo(ctx.blob, render);
      const remoteId = await uploadOnce(ctx.blob, { channelId, renderId: render.id }, video, {
        start: () => startSession(token, video, meta, categoryId),
        exists: (id) => videoOnChannel(token, id, channelId),
      });
      const now = nowIso();
      const upload: Upload = {
        id: newId(),
        projectId: render.projectId,
        renderId: render.id,
        provider: manifest.id,
        remoteId,
        remoteUrl: watchUrl(remoteId),
        channelId,
        privacy: "private",
        containsSyntheticMedia: meta.containsSyntheticMedia,
        status: "uploaded",
        meta,
        createdAt: now,
        updatedAt: now,
      };
      return upload;
    },

    async setPrivacy(upload, privacy, publishAt, target) {
      const token = await verifiedToken(target, "setPrivacy");
      const scheduled = Boolean(publishAt && new Date(publishAt).getTime() > Date.now());
      const wirePrivacy: Privacy = scheduled ? "private" : privacy;
      // videos.update replaces the whole status object: start from the current one so
      // embeddable, license, publicStatsViewable and the kids flag keep their values.
      const current = await getVideo(token, upload.remoteId);
      // The credential is right; the video must also belong to that channel (legacy uploads
      // have no recorded channel, and a record can be pointed at the wrong one).
      if (current.snippet?.channelId !== target!.channelId) {
        throw new ProviderError(
          `publish-youtube: video ${upload.remoteId} belongs to channel ${current.snippet?.channelId ?? "unknown"}, not ${target!.channelId}. ` +
            "Choose the channel the video was uploaded to.",
          409,
          false,
        );
      }
      const status = statusForUpdate(current.status ?? {}, {
        privacyStatus: wirePrivacy,
        containsSyntheticMedia: upload.containsSyntheticMedia,
        // YouTube accepts publishAt only on a private video, i.e. only when scheduling.
        publishAt: scheduled ? publishAt : undefined,
      });
      await updateStatus(token, upload.remoteId, status);
      return {
        ...upload,
        channelId: target!.channelId,
        privacy: wirePrivacy,
        publishAt: scheduled ? publishAt : undefined,
        publishTimeZone: scheduled ? upload.publishTimeZone : undefined,
        // A schedule is only a request: the video stays private until a status read sees it public.
        status: scheduled ? "scheduled" : privacy === "public" ? "published" : "uploaded",
        updatedAt: nowIso(),
      };
    },

    async status(upload, target) {
      const token = await accessToken(requireTarget(target, "status"));
      const video = await getVideo(token, upload.remoteId);
      const privacy = video.status?.privacyStatus ?? upload.privacy;
      const publishAt = video.status?.publishAt ?? (privacy === "public" ? undefined : upload.publishAt);
      return {
        ...upload,
        privacy,
        publishAt,
        containsSyntheticMedia: video.status?.containsSyntheticMedia ?? upload.containsSyntheticMedia,
        status: remoteStatus(privacy, publishAt),
        updatedAt: nowIso(),
      };
    },
  };
}

/** Published only when YouTube reports the video public; a pending publishAt keeps it scheduled. */
export function remoteStatus(privacy: Privacy, publishAt: string | undefined): Upload["status"] {
  if (privacy === "public") return "published";
  return publishAt ? "scheduled" : "uploaded";
}

function requireTarget(target: PublishTarget | undefined, action: string): PublishTarget {
  if (!target?.channelId || !target.credentialRef) {
    throw new ProviderError(`publish-youtube: ${action} needs a destination channel. Choose one on the project.`, undefined, false);
  }
  return target;
}

function channelMismatch(target: PublishTarget, actual: string | undefined): ProviderError {
  return new ProviderError(
    `publish-youtube: ${target.credentialRef} authenticates as channel ${actual ?? "(none)"}, but the destination is ${target.channelId}. ` +
      `Reconnect ${target.credentialRef} with the account that owns ${target.channelId}, or choose another channel. Nothing was sent.`,
    409,
    false,
  );
}

/** Exchange the refresh token named by `credentialRef` for an access token. */
export async function refreshAccessToken(
  env: Record<string, string | undefined>,
  credentialRef: string,
): Promise<{ value: string; expiresAt: number }> {
  const ref = CredentialRef.safeParse(credentialRef);
  if (!ref.success) throw new ProviderError(`publish-youtube: invalid credential reference "${credentialRef}"`, undefined, false);
  const clientId = requireEnv(env, "YOUTUBE_CLIENT_ID");
  const clientSecret = requireEnv(env, "YOUTUBE_CLIENT_SECRET");
  const refreshToken = requireEnv(env, ref.data);
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
    throw new ProviderError(`publish-youtube: oauth ${res.status} for ${ref.data}: ${json.error_description ?? "no access token"}`, res.status);
  }
  return { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
}

/** The channel the token acts as (`channels.list mine=true`). A read; costs 1 quota unit. */
export async function authenticatedChannelId(token: string): Promise<string | undefined> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set("mine", "true");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw youtubeError("channels.list", res.status, await snippet(res));
  const json = (await res.json()) as { items?: { id?: string }[] };
  return json.items?.[0]?.id;
}

/** Identity of a credential, for connecting a channel profile: the channel it authenticates as. */
export async function channelForCredential(env: Record<string, string | undefined>, credentialRef: string): Promise<string> {
  const token = await refreshAccessToken(env, credentialRef);
  const id = await authenticatedChannelId(token.value);
  if (!id) throw new ProviderError(`publish-youtube: ${credentialRef} has no YouTube channel`, undefined, false);
  return id;
}

/**
 * Upload a render to a channel at most once. A small record per (channel, render) in the blob
 * store holds the resumable session URL (saved before any bytes are sent) and, once done, the
 * video id:
 *
 * - video id recorded and the video still exists on the channel: return it, nothing is sent again;
 * - session recorded: always probe it (probes cost no quota); if YouTube already has every
 *   byte it answers with the video, otherwise the upload resumes from the confirmed offset;
 * - session gone (404, 410 or any other permanent error) or none recorded: start a new
 *   session. A finished session answers a probe with the video, never an error, and YouTube
 *   creates the video only when the last byte arrives, so starting over leaves no duplicate.
 *
 * Records written before channel profiles were keyed by render alone. Their video id is
 * reused only when `exists` confirms it is on this channel; their bare session URLs are not
 * resumed, because the channel that opened them is unknown.
 */
export async function uploadOnce(
  blob: BlobStore,
  key: UploadKey,
  video: VideoBody,
  remote: { start: () => Promise<string>; exists: (videoId: string) => Promise<boolean> },
  sleep = defaultSleep,
): Promise<string> {
  const record = await readSession(blob, sessionKey(key));
  if (record?.videoId && (await remote.exists(record.videoId))) return record.videoId;

  if (!record) {
    const legacy = await readSession(blob, legacySessionKey(key.renderId));
    if (legacy?.videoId && (await remote.exists(legacy.videoId))) {
      await writeSession(blob, { ...key, size: legacy.size, videoId: legacy.videoId, createdAt: nowIso() });
      return legacy.videoId;
    }
  }

  let done: YouTubeVideo | undefined;
  if (record?.location && !record.videoId && record.size === video.size) {
    done = await putResumable(record.location, video, sleep, { probeFirst: true }).catch((err: unknown) => {
      // The saved session is unusable: start over rather than block this render for good.
      if (err instanceof ProviderError && (err.status === 404 || !err.retriable)) return undefined;
      throw err;
    });
  }
  if (!done) {
    const location = await remote.start();
    await writeSession(blob, { ...key, location, size: video.size, createdAt: nowIso() });
    done = await putResumable(location, video, sleep);
  }
  if (!done.id) throw new ProviderError("publish-youtube: upload response had no video id", undefined, false);
  await writeSession(blob, { ...key, size: video.size, videoId: done.id, createdAt: nowIso() });
  return done.id;
}

export interface UploadKey {
  channelId: string;
  renderId: string;
}

export interface SessionRecord {
  /** Absent on records written before channel profiles. */
  channelId?: string;
  renderId: string;
  size: number;
  location?: string;
  videoId?: string;
  createdAt: string;
}

export function sessionKey(key: UploadKey): string {
  return `uploads/publish-youtube/${encodeURIComponent(key.channelId)}/${key.renderId}.json`;
}

/** Where uploads made before channel profiles kept their record. Read-only now. */
export function legacySessionKey(renderId: string): string {
  return `uploads/publish-youtube/${renderId}.json`;
}

async function readSession(blob: BlobStore, key: string): Promise<SessionRecord | undefined> {
  try {
    const bytes = await blob.get({ key, contentType: "application/json" });
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as SessionRecord;
  } catch (err) {
    // Missing record means no earlier attempt. Any other read failure must not be
    // mistaken for "none": that would start a second upload.
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

async function writeSession(blob: BlobStore, record: SessionRecord & UploadKey): Promise<void> {
  await blob.put(sessionKey(record), new Uint8Array(Buffer.from(JSON.stringify(record))), "application/json");
}

function isNotFound(err: unknown): boolean {
  const e = err as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } } | undefined;
  return e?.code === "ENOENT" || e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}

/** The video is on `channelId` and usable: deleted, failed or rejected videos count as gone. */
async function videoOnChannel(token: string, id: string, channelId: string): Promise<boolean> {
  try {
    const video = await getVideo(token, id);
    if (video.snippet?.channelId !== channelId) return false;
    return !["failed", "rejected", "deleted"].includes(String(video.status?.uploadStatus ?? ""));
  } catch (err) {
    if (err instanceof ProviderError && err.status === 404) return false;
    throw err;
  }
}

/** Open a resumable upload session; returns its URL. No video exists until every byte is sent. */
async function startSession(token: string, video: VideoBody, meta: UploadMeta, categoryId: string): Promise<string> {
  if (video.size <= 0) throw new ProviderError("publish-youtube: render file is empty", undefined, false);
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
  if (!location) throw new ProviderError("publish-youtube: insert session missing Location");
  return location;
}

/** Attempts per upload: each failed PUT is followed by a status probe and a resume from the confirmed offset. */
const UPLOAD_ATTEMPTS = 6;

export async function putResumable(
  location: string,
  video: VideoBody,
  sleep = defaultSleep,
  opts: { probeFirst?: boolean } = {},
): Promise<YouTubeVideo> {
  let offset = 0;
  let lastError = "no attempt made";
  // After a failed PUT the server may hold more bytes than we think: confirm the offset
  // with a status probe before sending again, never resend from a guessed offset.
  // Resuming a saved session starts with a probe for the same reason.
  let needsProbe = opts.probeFirst === true;
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
      if (probe.status === 404 || probe.status === 410) throw new ProviderError("publish-youtube: upload session expired", 404, true);
      if (probe.status !== 308) {
        const body = await snippet(probe);
        lastError = `probe: ${probe.status} ${body}`;
        const error = youtubeError("upload probe", probe.status, body);
        if (!error.retriable) throw error;
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
    if (res.status === 404 || res.status === 410) throw new ProviderError("publish-youtube: upload session expired", 404, true);
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
  url.searchParams.set("part", "status,snippet");
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
