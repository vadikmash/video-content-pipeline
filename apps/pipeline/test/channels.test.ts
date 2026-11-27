import { isPermanentError, type Upload } from "@vcp/core";
import { remoteIdFor, uploadsByRemoteId } from "@vcp/provider-fake-publish";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WORK_STAGES, approveGate, confirmRelease, isCurrentPublishApproval, publish, runStage, upload } from "../src/stages/index";
import { makeWorld } from "./helpers";

/** Run every work stage up to (not including) `stop`, approving gates automatically. */
async function runUntil(world: ReturnType<typeof makeWorld>, stop: "upload" | "publish") {
  for (const def of WORK_STAGES) {
    if (def.name === stop) return;
    await runStage(def, world.project.id, world.deps);
    if (def.name === "render") await approveGate(world.project.id, "approve-video", "auto", {}, world.store);
  }
}

describe("channel destinations", () => {
  let world: ReturnType<typeof makeWorld>;
  afterEach(() => {
    world?.cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("a replay reuses the remote id for the same channel and render", async () => {
    world = makeWorld();
    const { store, project, deps } = world;
    store.addChannel("UC-en", "English");
    store.setProjectChannel(project.id, "UC-en");
    await runUntil(world, "publish");
    const first = store.uploads[0]!;
    expect(first.channelId).toBe("UC-en");
    expect(first.remoteId).toBe(remoteIdFor(first.renderId, "UC-en"));

    // The step is replayed after the row was saved (stage row lost its "done").
    await store.upsertStage(project.id, "upload", { status: "failed", error: "replayed" });
    const again = await runStage(upload, project.id, deps);
    expect(again.artifactId).toBe(first.id);
    expect(again.summary).toMatchObject({ reused: true, remoteId: first.remoteId, channelId: "UC-en" });
    expect(store.uploads).toHaveLength(1);
  });

  it("changing the destination after a private upload makes a second, independent record", async () => {
    world = makeWorld();
    const { store, project, deps } = world;
    store.addChannel("UC-en", "English");
    store.addChannel("UC-ru", "Russian");
    store.setProjectChannel(project.id, "UC-en");
    await runUntil(world, "publish");
    const en = store.uploads[0]!;

    // The approval the reviewer gave for the English upload goes stale with the change.
    store.setProjectChannel(project.id, "UC-ru");
    expect(await isCurrentPublishApproval(project.id, en.id, store)).toBe(false);
    const remoteBefore = uploadsByRemoteId.get(en.remoteId);
    await expect(runStage(publish, project.id, deps)).rejects.toThrow(/no upload of the latest render to UC-ru/);
    expect(uploadsByRemoteId.get(en.remoteId)).toBe(remoteBefore);

    // Upload again to the new destination: same render, new remote record.
    const out = await runStage(upload, project.id, deps);
    expect(out.skipped).toBe(false);
    expect(store.uploads).toHaveLength(2);
    const ru = store.uploads[1]!;
    expect(ru).toMatchObject({ channelId: "UC-ru", renderId: en.renderId, privacy: "private" });
    expect(ru.remoteId).not.toBe(en.remoteId);
    expect(await isCurrentPublishApproval(project.id, ru.id, store)).toBe(true);

    await approveGate(project.id, "approve-publish", "user", { uploadId: ru.id }, store);
    await runStage(publish, project.id, deps);
    // The English record keeps its channel, remote id and privacy, here and remotely.
    expect(store.uploads.find((u) => u.id === en.id)).toMatchObject({ channelId: "UC-en", remoteId: en.remoteId, privacy: "private", status: "uploaded" });
    expect(uploadsByRemoteId.get(en.remoteId)?.privacy).toBe("private");
    expect(store.uploads.find((u) => u.id === ru.id)).toMatchObject({ privacy: "public", status: "published" });
  });

  it("a scheduled upload is marked published only after a status read confirms it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T10:00:00Z"));
    world = makeWorld();
    const { store, project, deps } = world;
    store.addChannel("UC-en", "English");
    store.setProjectChannel(project.id, "UC-en");
    await runUntil(world, "publish");
    const up = store.uploads[0]!;

    // Reviewer in Moscow picks 18:30 local on Dec 1st; stored as a UTC instant plus the zone.
    await approveGate(project.id, "approve-publish", "user", {
      uploadId: up.id,
      publishAt: "2026-12-01T15:30:00.000Z",
      publishTimeZone: "Europe/Moscow",
    }, store);
    await runStage(publish, project.id, deps);

    const scheduled = (await store.getUpload(up.id))!;
    expect(scheduled).toMatchObject({ status: "scheduled", privacy: "private", publishAt: "2026-12-01T15:30:00.000Z", publishTimeZone: "Europe/Moscow" });
    expect((await store.getProject(project.id))?.status).not.toBe("published");
    expect((await store.getIdea(project.ideaId))?.status).not.toBe("done");

    // Before the time, a status read keeps it scheduled.
    expect(await confirmRelease(project.id, up.id, deps)).toBe("scheduled");
    expect((await store.getProject(project.id))?.status).toBe("waiting");

    // After the time, the remote reports it public; only now is the project published.
    vi.setSystemTime(new Date("2026-12-01T15:31:00Z"));
    expect(await confirmRelease(project.id, up.id, deps)).toBe("published");
    expect((await store.getUpload(up.id))).toMatchObject({ status: "published", privacy: "public" });
    expect((await store.getProject(project.id))?.status).toBe("published");
    expect((await store.getIdea(project.ideaId))?.status).toBe("done");
    expect(store.events.some((e) => e.type === "upload.published")).toBe(true);
  });

  it("an approval without a time publishes now even after an earlier schedule", async () => {
    world = makeWorld();
    const { store, project } = world;
    await runUntil(world, "publish");
    const up = store.uploads[0]!;
    await approveGate(project.id, "approve-publish", "user", { uploadId: up.id, publishAt: "2030-01-01T00:00:00.000Z", publishTimeZone: "UTC" }, store);
    await approveGate(project.id, "approve-publish", "user", { uploadId: up.id }, store);
    const after = (await store.getUpload(up.id)) as Upload;
    expect(after.publishAt).toBeUndefined();
    expect(after.publishTimeZone).toBeUndefined();
  });

  it("dry runs and the fake publisher still upload without a channel", async () => {
    world = makeWorld();
    await runUntil(world, "publish");
    expect(world.store.uploads[0]).toMatchObject({ provider: "fake-publish" });
    expect(world.store.uploads[0]!.channelId).toBeUndefined();
  });

  describe("with the real YouTube publisher bound", () => {
    function stubYouTube(authenticatedAs: string) {
      const writes: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string | URL, init?: RequestInit) => {
          const u = String(url);
          const method = init?.method ?? "GET";
          if (u.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
          if (method !== "GET") writes.push(`${method} ${u}`);
          if (u.includes("/channels?")) return Response.json({ items: [{ id: authenticatedAs }] });
          return Response.json({ error: "unexpected" }, { status: 500 });
        }),
      );
      return writes;
    }

    async function realPublisherWorld() {
      const w = makeWorld();
      await runUntil(w, "upload");
      w.config.ports.Publisher = { providerId: "publish-youtube", options: {} };
      vi.stubEnv("YOUTUBE_CLIENT_ID", "id");
      vi.stubEnv("YOUTUBE_CLIENT_SECRET", "secret");
      vi.stubEnv("YOUTUBE_REFRESH_TOKEN_RU", "refresh-ru");
      return w;
    }

    it("a credential for a different channel makes zero remote writes", async () => {
      world = await realPublisherWorld();
      const { store, project, deps } = world;
      store.addChannel("UC-en", "English", "YOUTUBE_REFRESH_TOKEN_RU");
      store.setProjectChannel(project.id, "UC-en");
      const writes = stubYouTube("UC-ru");

      const err = await runStage(upload, project.id, deps).catch((e) => e);
      expect(err.message).toMatch(/authenticates as channel UC-ru, but the destination is UC-en/);
      expect(isPermanentError(err)).toBe(true);
      expect(writes).toEqual([]);
      expect(store.uploads).toEqual([]);
      expect((await store.getStage(project.id, "upload"))?.status).toBe("failed");
    });

    it("refuses a real upload when the project has no channel, before any request", async () => {
      world = await realPublisherWorld();
      const { store, project, deps } = world;
      stubYouTube("UC-en");
      const err = await runStage(upload, project.id, deps).catch((e) => e);
      expect(err.message).toMatch(/Choose a destination channel/);
      expect(isPermanentError(err)).toBe(true);
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
      expect(store.uploads).toEqual([]);
    });
  });
});
