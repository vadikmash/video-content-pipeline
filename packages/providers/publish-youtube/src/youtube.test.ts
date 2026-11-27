import { isPermanentError, type BlobStore, type ProviderContext, type Upload } from "@vcp/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { create, nextOffset, putResumable, remoteStatus, statusForUpdate, uploadOnce, youtubeError, type VideoBody } from "./index";

const noSleep = async () => {};
const video = (size = 10): VideoBody => ({ size, open: (start) => ({ body: new Uint8Array(size - start) as unknown as BodyInit }) });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

afterEach(() => vi.unstubAllGlobals());

describe("nextOffset", () => {
  it("continues after the last confirmed byte", () => {
    expect(nextOffset("bytes=0-4")).toBe(5);
  });
  it("restarts from 0 when the server confirms nothing", () => {
    expect(nextOffset(null)).toBe(0);
  });
});

describe("putResumable", () => {
  it("resumes the same session after a dropped connection instead of inserting again", async () => {
    const calls: { range: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const range = new Headers(init.headers).get("content-range");
        calls.push({ range });
        if (calls.length === 1) throw new TypeError("fetch failed: ECONNRESET");
        if (range === "bytes */10") return new Response(null, { status: 308, headers: { range: "bytes=0-5" } });
        return json({ id: "vid123" });
      }),
    );
    const out = await putResumable("https://upload.example/session", video(), noSleep);
    expect(out.id).toBe("vid123");
    expect(calls.map((c) => c.range)).toEqual(["bytes 0-9/10", "bytes */10", "bytes 6-9/10"]);
  });

  it("never resends from a guessed offset when the status probe also fails", async () => {
    const ranges: (string | null)[] = [];
    let probes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const range = new Headers(init.headers).get("content-range");
        ranges.push(range);
        if (ranges.length === 1) throw new TypeError("fetch failed: ECONNRESET");
        if (range === "bytes */10") {
          probes++;
          if (probes === 1) throw new TypeError("probe failed too");
          return new Response(null, { status: 308, headers: { range: "bytes=0-7" } });
        }
        return json({ id: "vid123" });
      }),
    );
    const out = await putResumable("https://upload.example/session", video(), noSleep);
    expect(out.id).toBe("vid123");
    expect(ranges).toEqual(["bytes 0-9/10", "bytes */10", "bytes */10", "bytes 8-9/10"]);
  });

  it("retries a rate-limit 403 on the upload PUT after confirming the offset", async () => {
    const ranges: (string | null)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const range = new Headers(init.headers).get("content-range");
        ranges.push(range);
        if (ranges.length === 1) return json({ error: { errors: [{ reason: "rateLimitExceeded" }] } }, 403);
        if (range === "bytes */10") return new Response(null, { status: 308 });
        return json({ id: "vid123" });
      }),
    );
    const out = await putResumable("https://upload.example/session", video(), noSleep);
    expect(out.id).toBe("vid123");
    expect(ranges).toEqual(["bytes 0-9/10", "bytes */10", "bytes 0-9/10"]);
  });

  it("fails permanently when the status probe gets a permanent error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const range = new Headers(init.headers).get("content-range");
        if (range === "bytes */10") return json({ error: "bad range" }, 400);
        throw new TypeError("fetch failed");
      }),
    );
    const err = await putResumable("https://upload.example/session", video(), noSleep).catch((e) => e);
    expect(err.message).toMatch(/upload probe 400/);
    expect(isPermanentError(err)).toBe(true);
  });

  it("treats an expired session as retriable so the stage starts a fresh one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const range = new Headers(init.headers).get("content-range");
        if (range === "bytes */10") return json({}, 404);
        return json({ error: "server" }, 503);
      }),
    );
    const err = await putResumable("https://upload.example/session", video(), noSleep).catch((e) => e);
    expect(err.message).toMatch(/session expired/);
    expect(isPermanentError(err)).toBe(false);
  });

  it("fails permanently on a 4xx from the session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "bad" }, 400)));
    const err = await putResumable("https://upload.example/session", video(), noSleep).catch((e) => e);
    expect(isPermanentError(err)).toBe(true);
  });

  it("gives up as retriable after repeated network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const err = await putResumable("https://upload.example/session", video(), noSleep).catch((e) => e);
    expect(err.message).toMatch(/after 6 attempts/);
    expect(isPermanentError(err)).toBe(false);
  });
});

describe("youtubeError", () => {
  it("treats quota and scope 403s as permanent but rate-limit 403s as retriable", () => {
    expect(isPermanentError(youtubeError("update", 403, '{"reason": "insufficientPermissions"}'))).toBe(true);
    expect(isPermanentError(youtubeError("update", 403, '{"reason": "quotaExceeded"}'))).toBe(true);
    expect(isPermanentError(youtubeError("update", 403, '{"reason": "rateLimitExceeded"}'))).toBe(false);
    expect(isPermanentError(youtubeError("update", 503, "backend error"))).toBe(false);
  });
});

describe("statusForUpdate", () => {
  it("keeps the video's other status fields and drops read-only ones", () => {
    const next = statusForUpdate(
      {
        uploadStatus: "processed",
        madeForKids: false,
        privacyStatus: "private",
        embeddable: true,
        publicStatsViewable: true,
        license: "youtube",
        selfDeclaredMadeForKids: false,
        publishAt: "2030-01-01T00:00:00Z",
      },
      { privacyStatus: "public", containsSyntheticMedia: false, publishAt: undefined },
    );
    expect(next).toEqual({
      privacyStatus: "public",
      embeddable: true,
      publicStatsViewable: true,
      license: "youtube",
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: false,
    });
  });
});

describe("setPrivacy", () => {
  const ctx: ProviderContext = {
    env: { YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "secret", YOUTUBE_REFRESH_TOKEN: "refresh" },
    options: {},
    blob: {} as BlobStore,
  } as ProviderContext;
  const target = { channelId: "UC-main", credentialRef: "YOUTUBE_REFRESH_TOKEN" };
  const upload = {
    id: "u1",
    projectId: "p1",
    renderId: "r1",
    provider: "publish-youtube",
    remoteId: "vid123",
    remoteUrl: "https://www.youtube.com/watch?v=vid123",
    channelId: "UC-main",
    privacy: "private",
    containsSyntheticMedia: false,
    status: "uploaded",
    meta: { title: "t", description: "d", tags: [], containsSyntheticMedia: false },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as Upload;

  function stubYouTube(opts: { channel?: string; videoChannel?: string } = {}) {
    const updates: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const u = String(url);
        if (u.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "tok", expires_in: 3600 });
        if (u.includes("/channels?")) return json({ items: [{ id: opts.channel ?? "UC-main" }] });
        if (u.includes("/videos?") && !init?.method) {
          return json({
            items: [
              {
                id: "vid123",
                snippet: { channelId: opts.videoChannel ?? "UC-main" },
                status: { privacyStatus: "private", embeddable: true, uploadStatus: "processed" },
              },
            ],
          });
        }
        if (init?.method === "PUT") {
          updates.push(JSON.parse(String(init.body)).status);
          return json({});
        }
        throw new Error(`unexpected ${u}`);
      }),
    );
    return updates;
  }

  it("publishes without sending publishAt and keeps existing status fields", async () => {
    const updates = stubYouTube();
    const out = await create(ctx).setPrivacy(upload, "public", "2020-01-01T00:00:00Z", target);
    expect(updates[0]).toEqual({ privacyStatus: "public", embeddable: true, containsSyntheticMedia: false });
    expect(out.status).toBe("published");
    expect(out.publishAt).toBeUndefined();
  });

  it("schedules as private with publishAt when the time is in the future, and reports scheduled", async () => {
    const updates = stubYouTube();
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const out = await create(ctx).setPrivacy({ ...upload, publishTimeZone: "Europe/Moscow" }, "public", when, target);
    expect(updates[0]).toMatchObject({ privacyStatus: "private", publishAt: when, embeddable: true });
    expect(out.status).toBe("scheduled");
    expect(out.privacy).toBe("private");
    expect(out.publishTimeZone).toBe("Europe/Moscow");
  });

  it("refuses with a fixable error and no write when the credential is for another channel", async () => {
    const updates = stubYouTube({ channel: "UC-other" });
    const err = await create(ctx).setPrivacy(upload, "public", undefined, target).catch((e) => e);
    expect(err.message).toMatch(/authenticates as channel UC-other.*destination is UC-main/);
    expect(isPermanentError(err)).toBe(true);
    expect(updates).toEqual([]);
  });

  it("refuses to change a video that belongs to a different channel", async () => {
    const updates = stubYouTube({ videoChannel: "UC-legacy" });
    const err = await create(ctx).setPrivacy(upload, "public", undefined, target).catch((e) => e);
    expect(err.message).toMatch(/belongs to channel UC-legacy/);
    expect(updates).toEqual([]);
  });

  it("requires a destination channel", async () => {
    const updates = stubYouTube();
    const err = await create(ctx).setPrivacy(upload, "public").catch((e) => e);
    expect(err.message).toMatch(/needs a destination channel/);
    expect(isPermanentError(err)).toBe(true);
    expect(updates).toEqual([]);
  });

  it("refuses credential references outside the YouTube refresh-token family", async () => {
    stubYouTube();
    const err = await create({ ...ctx, env: { ...ctx.env, OPENAI_API_KEY: "sk" } })
      .setPrivacy(upload, "public", undefined, { channelId: "UC-main", credentialRef: "OPENAI_API_KEY" })
      .catch((e) => e);
    expect(err.message).toMatch(/invalid credential reference/);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("status", () => {
  it("is published only once YouTube reports the video public", () => {
    expect(remoteStatus("private", "2030-01-01T00:00:00Z")).toBe("scheduled");
    // publishAt has passed but YouTube has not flipped it yet: still scheduled, not published.
    expect(remoteStatus("private", "2020-01-01T00:00:00Z")).toBe("scheduled");
    expect(remoteStatus("public", undefined)).toBe("published");
    expect(remoteStatus("private", undefined)).toBe("uploaded");
  });
});

describe("upload (channel identity)", () => {
  function memoryBlob(): BlobStore & { data: Map<string, Uint8Array> } {
    const data = new Map<string, Uint8Array>();
    return {
      id: "memory",
      data,
      async put(key, bytes, contentType) {
        data.set(key, bytes);
        return { key, contentType, size: bytes.byteLength };
      },
      async get(ref) {
        const bytes = data.get(ref.key);
        if (!bytes) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return bytes;
      },
      async url(ref) {
        return ref.key;
      },
    };
  }
  const render = {
    id: "render-x",
    projectId: "p1",
    storyboardId: "s1",
    templateId: "t",
    templateVersion: "1",
    blob: { key: "renders/x.mp4", contentType: "video/mp4" },
    durationSec: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    provider: "fake-render",
    createdAt: "2026-01-01T00:00:00Z",
  };
  const meta = { title: "t", description: "d", tags: [], containsSyntheticMedia: false };

  /** Every request, with writes (anything but GET and the OAuth exchange) flagged. */
  function stubAll(authenticatedAs: Record<string, string>) {
    const calls: { url: string; method: string; write: boolean }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const u = String(url);
        const method = init?.method ?? "GET";
        const oauth = u.startsWith("https://oauth2.googleapis.com/token");
        calls.push({ url: u, method, write: method !== "GET" && !oauth });
        if (oauth) {
          const refresh = new URLSearchParams(String(init?.body)).get("refresh_token")!;
          return json({ access_token: `tok:${refresh}`, expires_in: 3600 });
        }
        const token = new Headers(init?.headers).get("authorization")?.replace("Bearer tok:", "") ?? "";
        if (u.includes("/channels?")) return json({ items: [{ id: authenticatedAs[token] }] });
        if (u.includes("/upload/youtube/v3/videos")) return new Response(null, { status: 200, headers: { location: `https://upload.example/${token}` } });
        if (u.startsWith("https://upload.example/")) return json({ id: `vid-${u.split("/").pop()}` });
        if (u.includes("/videos?")) {
          const id = new URL(u).searchParams.get("id");
          return json({ items: [{ id, snippet: { channelId: authenticatedAs[`owner:${id}`] }, status: { uploadStatus: "processed" } }] });
        }
        throw new Error(`unexpected ${method} ${u}`);
      }),
    );
    return calls;
  }

  it("makes zero remote writes when the credential authenticates as a different channel", async () => {
    const blob = memoryBlob();
    blob.data.set(render.blob.key, new Uint8Array(10));
    const calls = stubAll({ "refresh-ru": "UC-ru" });
    const ctx = { env: { YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "s", YOUTUBE_REFRESH_TOKEN_RU: "refresh-ru" }, options: {}, blob };
    const err = await create(ctx)
      .upload(render, meta, "private", { channelId: "UC-en", credentialRef: "YOUTUBE_REFRESH_TOKEN_RU" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Reconnect YOUTUBE_REFRESH_TOKEN_RU.*Nothing was sent/);
    expect(isPermanentError(err)).toBe(true);
    expect(calls.filter((c) => c.write)).toEqual([]);
    expect(calls.some((c) => c.url.includes("/channels?"))).toBe(true);
    // No session record either: a later retry with the right credential starts clean.
    expect([...blob.data.keys()].filter((k) => k.startsWith("uploads/"))).toEqual([]);
  });

  it("uses the credential the channel profile names, and keys the record by channel", async () => {
    const blob = memoryBlob();
    blob.data.set(render.blob.key, new Uint8Array(10));
    stubAll({ "refresh-ru": "UC-ru" });
    const ctx = { env: { YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "s", YOUTUBE_REFRESH_TOKEN_RU: "refresh-ru" }, options: {}, blob };
    const up = await create(ctx).upload(render, meta, "private", { channelId: "UC-ru", credentialRef: "YOUTUBE_REFRESH_TOKEN_RU" });
    expect(up.channelId).toBe("UC-ru");
    expect(up.remoteId).toBe("vid-refresh-ru");
    expect(blob.data.has("uploads/publish-youtube/UC-ru/render-x.json")).toBe(true);
  });
});

describe("uploadOnce (idempotent per channel and render)", () => {
  function memoryBlob(): BlobStore & { data: Map<string, Uint8Array> } {
    const data = new Map<string, Uint8Array>();
    return {
      id: "memory",
      data,
      async put(key, bytes, contentType) {
        data.set(key, bytes);
        return { key, contentType, size: bytes.byteLength };
      },
      async get(ref) {
        const bytes = data.get(ref.key);
        if (!bytes) throw Object.assign(new Error("missing"), { code: "ENOENT" });
        return bytes;
      },
      async url(ref) {
        return ref.key;
      },
    };
  }
  const session = "https://upload.example/session-1";

  /** fetch stub for the session: `behave` decides per call. Records content ranges. */
  function stubSession(behave: (range: string | null, n: number) => Response | Promise<Response>) {
    const ranges: (string | null)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const range = new Headers(init.headers).get("content-range");
        ranges.push(range);
        return behave(range, ranges.length);
      }),
    );
    return ranges;
  }

  it("saves the session before sending bytes and resumes it on the next attempt instead of starting another", async () => {
    const blob = memoryBlob();
    let starts = 0;
    const remote = { start: async () => (starts++, session), exists: async () => true };

    // Attempt 1: every PUT and probe fails, so the provider gives up (retriable).
    stubSession(() => {
      throw new TypeError("network down");
    });
    const first = await uploadOnce(blob, { channelId: "UC1", renderId: "render-1" }, video(), remote, noSleep).catch((e) => e);
    expect(isPermanentError(first)).toBe(false);
    expect(JSON.parse(Buffer.from(blob.data.get("uploads/publish-youtube/UC1/render-1.json")!).toString()).location).toBe(session);

    // Attempt 2 (the stage retry): probes the saved session, resumes from byte 4.
    const ranges = stubSession((range) =>
      range === "bytes */10" ? new Response(null, { status: 308, headers: { range: "bytes=0-3" } }) : json({ id: "vid-1" }),
    );
    expect(await uploadOnce(blob, { channelId: "UC1", renderId: "render-1" }, video(), remote, noSleep)).toBe("vid-1");
    expect(starts).toBe(1);
    expect(ranges).toEqual(["bytes */10", "bytes 4-9/10"]);
  });

  it("returns the video when YouTube already has every byte but the result was lost", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/UC1/render-2.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-2", location: session, size: 10, createdAt: new Date().toISOString() }))),
      "application/json",
    );
    let starts = 0;
    const ranges = stubSession(() => json({ id: "vid-2" }));
    const id = await uploadOnce(blob, { channelId: "UC1", renderId: "render-2" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep);
    expect(id).toBe("vid-2");
    expect(starts).toBe(0);
    expect(ranges).toEqual(["bytes */10"]);
  });

  it("returns the recorded video without any upload call once it is done", async () => {
    const blob = memoryBlob();
    const ranges = stubSession(() => json({ id: "vid-3" }));
    const remote = { start: async () => session, exists: async () => true };
    expect(await uploadOnce(blob, { channelId: "UC1", renderId: "render-3" }, video(), remote, noSleep)).toBe("vid-3");
    ranges.length = 0;
    let starts = 0;
    expect(await uploadOnce(blob, { channelId: "UC1", renderId: "render-3" }, video(), { ...remote, start: async () => (starts++, session) }, noSleep)).toBe("vid-3");
    expect(ranges).toEqual([]);
    expect(starts).toBe(0);
  });

  it("starts a new session when the saved one has expired", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/UC1/render-4.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-4", location: "https://upload.example/old", size: 10, createdAt: new Date().toISOString() }))),
      "application/json",
    );
    let starts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/old") ? json({}, 404) : json({ id: "vid-4" }))),
    );
    const id = await uploadOnce(blob, { channelId: "UC1", renderId: "render-4" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep);
    expect(id).toBe("vid-4");
    expect(starts).toBe(1);
  });

  it("uploads again if the recorded video was deleted on YouTube", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/UC1/render-5.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-5", videoId: "gone", size: 10, createdAt: new Date().toISOString() }))),
      "application/json",
    );
    stubSession(() => json({ id: "vid-5" }));
    let starts = 0;
    const id = await uploadOnce(blob, { channelId: "UC1", renderId: "render-5" }, video(), { start: async () => (starts++, session), exists: async () => false }, noSleep);
    expect(id).toBe("vid-5");
    expect(starts).toBe(1);
  });

  it("starts over when the saved session answers with a permanent error, instead of blocking the render", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/UC1/render-7.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-7", location: "https://upload.example/dead", size: 10, createdAt: "2020-01-01T00:00:00Z" }))),
      "application/json",
    );
    let starts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/dead") ? json({ error: "bad" }, 400) : json({ id: "vid-7" }))),
    );
    const id = await uploadOnce(blob, { channelId: "UC1", renderId: "render-7" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep);
    expect(id).toBe("vid-7");
    expect(starts).toBe(1);
  });

  it("probes a saved session however old it is, so a finished upload is never repeated", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/UC1/render-8.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-8", location: session, size: 10, createdAt: "2020-01-01T00:00:00Z" }))),
      "application/json",
    );
    let starts = 0;
    stubSession(() => json({ id: "vid-8" }));
    const id = await uploadOnce(blob, { channelId: "UC1", renderId: "render-8" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep);
    expect(id).toBe("vid-8");
    expect(starts).toBe(0);
  });

  it("does not resume a session saved for a file of a different size", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/UC1/render-9.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-9", location: "https://upload.example/other", size: 99, createdAt: new Date().toISOString() }))),
      "application/json",
    );
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return json({ id: "vid-9" });
      }),
    );
    let starts = 0;
    const id = await uploadOnce(blob, { channelId: "UC1", renderId: "render-9" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep);
    expect(id).toBe("vid-9");
    expect(starts).toBe(1);
    expect(urls.some((u) => u.endsWith("/other"))).toBe(false);
  });

  it("does not treat a failing blob store as 'no earlier attempt'", async () => {
    const blob = memoryBlob();
    blob.get = async () => {
      throw new Error("blob store unavailable");
    };
    let starts = 0;
    const err = await uploadOnce(blob, { channelId: "UC1", renderId: "render-6" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep).catch(
      (e) => e,
    );
    expect(err.message).toMatch(/blob store unavailable/);
    expect(starts).toBe(0);
  });

  it("replays reuse the remote id for the same channel and render, and a new channel gets its own record", async () => {
    const blob = memoryBlob();
    let n = 0;
    stubSession(() => json({ id: `vid-${++n}` }));
    const remote = { start: async () => session, exists: async () => true };
    const en = await uploadOnce(blob, { channelId: "UC-en", renderId: "render-10" }, video(), remote, noSleep);
    expect(await uploadOnce(blob, { channelId: "UC-en", renderId: "render-10" }, video(), remote, noSleep)).toBe(en);
    const ru = await uploadOnce(blob, { channelId: "UC-ru", renderId: "render-10" }, video(), remote, noSleep);
    expect(ru).not.toBe(en);
    const read = (k: string) => JSON.parse(Buffer.from(blob.data.get(k)!).toString());
    expect(read("uploads/publish-youtube/UC-en/render-10.json")).toMatchObject({ channelId: "UC-en", videoId: en });
    expect(read("uploads/publish-youtube/UC-ru/render-10.json")).toMatchObject({ channelId: "UC-ru", videoId: ru });
  });

  it("reuses a legacy per-render record only when the video is on this channel", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/render-11.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-11", videoId: "old-vid", size: 10, createdAt: "2026-01-01T00:00:00Z" }))),
      "application/json",
    );
    const ranges = stubSession(() => json({ id: "new-vid" }));
    let starts = 0;
    const owned = new Set(["UC-owner"]);
    const remoteFor = (channelId: string) => ({ start: async () => (starts++, session), exists: async () => owned.has(channelId) });

    expect(await uploadOnce(blob, { channelId: "UC-owner", renderId: "render-11" }, video(), remoteFor("UC-owner"), noSleep)).toBe("old-vid");
    expect(starts).toBe(0);
    expect(ranges).toEqual([]);
    // The legacy record is left as it was; the channel-keyed one now carries the binding.
    expect(blob.data.has("uploads/publish-youtube/render-11.json")).toBe(true);
    expect(JSON.parse(Buffer.from(blob.data.get("uploads/publish-youtube/UC-owner/render-11.json")!).toString()).videoId).toBe("old-vid");

    expect(await uploadOnce(blob, { channelId: "UC-other", renderId: "render-11" }, video(), remoteFor("UC-other"), noSleep)).toBe("new-vid");
    expect(starts).toBe(1);
  });

  it("does not resume a legacy session URL, whose channel is unknown", async () => {
    const blob = memoryBlob();
    await blob.put(
      "uploads/publish-youtube/render-12.json",
      new Uint8Array(Buffer.from(JSON.stringify({ renderId: "render-12", location: "https://upload.example/legacy", size: 10, createdAt: new Date().toISOString() }))),
      "application/json",
    );
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return json({ id: "vid-12" });
      }),
    );
    let starts = 0;
    expect(await uploadOnce(blob, { channelId: "UC1", renderId: "render-12" }, video(), { start: async () => (starts++, session), exists: async () => true }, noSleep)).toBe("vid-12");
    expect(starts).toBe(1);
    expect(urls.some((u) => u.endsWith("/legacy"))).toBe(false);
  });
});
