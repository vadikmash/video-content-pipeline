/**
 * Golden end-to-end (tech-plan section 9): manual idea -> fake providers ->
 * a real Remotion render of the placeholder composition -> fake publisher.
 * Needs Chromium (Remotion downloads it on first run) and ~1 minute.
 * Run with: E2E=1 pnpm --filter @vcp/pipeline test:e2e
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { uploadsByRemoteId } from "@vcp/provider-fake-publish";
import { afterAll, describe, expect, it } from "vitest";
import { WORK_STAGES, runStage } from "../src/stages/index";
import { makeWorld } from "./helpers";

const enabled = process.env.E2E === "1";

describe.skipIf(!enabled)("golden e2e with real Remotion render", () => {
  const world = makeWorld({ Renderer: { providerId: "render-remotion", options: { concurrency: 2 } } });
  afterAll(() => world.cleanup());

  it("produces an MP4 and a thumbnail, then publishes through the fake publisher", async () => {
    const { project, store, deps } = world;

    for (const def of WORK_STAGES) {
      const out = await runStage(def, project.id, deps);
      expect(out.skipped, def.name).toBe(false);
    }

    const render = await store.latestRender(project.id);
    expect(render?.provider).toBe("render-remotion");
    const mp4 = path.join(world.dir, render!.blob.key);
    expect(existsSync(mp4)).toBe(true);
    expect(statSync(mp4).size).toBeGreaterThan(10_000);
    expect(render!.thumbnailBlob && existsSync(path.join(world.dir, render!.thumbnailBlob.key))).toBe(true);
    expect(render!.width).toBe(1080);
    expect(render!.height).toBe(1920);
    expect(render!.durationSec).toBeGreaterThan(5);

    const upload = await store.latestUpload(project.id);
    expect(upload?.provider).toBe("fake-publish");
    expect(upload?.privacy).toBe("public");
    expect(uploadsByRemoteId.get(upload!.remoteId)?.status).toBe("published");

    // Upload went up private first; the publish stage flipped it.
    const uploadEvent = store.events.find((e) => e.type === "upload.publish");
    expect(uploadEvent ?? null).toBeNull(); // auto gates record nothing here; the Inngest gate does
    expect((await store.getProject(project.id))?.status).toBe("published");
  }, 240_000);
});
