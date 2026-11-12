import { isPermanentError, type BlobStore, type ProviderContext, type Upload } from "@vcp/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { create, nextOffset, putResumable, statusForUpdate, youtubeError, type VideoBody } from "./index";

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
  const upload = {
    id: "u1",
    projectId: "p1",
    renderId: "r1",
    provider: "publish-youtube",
    remoteId: "vid123",
    remoteUrl: "https://www.youtube.com/watch?v=vid123",
    privacy: "private",
    containsSyntheticMedia: false,
    status: "uploaded",
    meta: { title: "t", description: "d", tags: [], containsSyntheticMedia: false },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as Upload;

  function stubYouTube() {
    const updates: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const u = String(url);
        if (u.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "tok", expires_in: 3600 });
        if (u.includes("/videos?part=status&id=") || (u.includes("/videos") && !init?.method)) {
          return json({ items: [{ id: "vid123", status: { privacyStatus: "private", embeddable: true, uploadStatus: "processed" } }] });
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
    const out = await create(ctx).setPrivacy(upload, "public", "2020-01-01T00:00:00Z");
    expect(updates[0]).toEqual({ privacyStatus: "public", embeddable: true, containsSyntheticMedia: false });
    expect(out.status).toBe("published");
    expect(out.publishAt).toBeUndefined();
  });

  it("schedules as private with publishAt when the time is in the future", async () => {
    const updates = stubYouTube();
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const out = await create(ctx).setPrivacy(upload, "public", when);
    expect(updates[0]).toMatchObject({ privacyStatus: "private", publishAt: when, embeddable: true });
    expect(out.status).toBe("scheduled");
  });
});
