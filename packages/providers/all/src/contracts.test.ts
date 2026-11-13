/**
 * Port contract tests. Each describe block states what any provider of that
 * port must do, and runs it against every registered provider. Fakes always
 * run; real providers run only when REAL_PROVIDERS=1 (they need keys).
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Asset, NewIdea, Render, Upload, Word, type BlobStore, type PortName, type Storyboard } from "@vcp/core";
import { createLocalBlobStore } from "@vcp/provider-blob-local";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createRegistry } from "./index";

const registry = createRegistry();
const includeReal = process.env.REAL_PROVIDERS === "1";
const includeYoutube = process.env.YOUTUBE_CONTRACT === "1";

let dir: string;
let blob: BlobStore;
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "vcp-contracts-"));
  blob = createLocalBlobStore({ dir });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function providersFor<P extends PortName>(port: P) {
  return registry
    .manifestsFor(port)
    // Real providers need keys; local-only ones (no network) always run.
    // YouTube insert spends a daily quota unit, so it stays behind its own flag.
    .filter((m) => {
      if (m.id === "publish-youtube") return includeYoutube;
      if (m.fake || m.id === "blob-local" || m.id === "source-manual") return true;
      // A real provider without its API key cannot run; skip it instead of failing.
      return includeReal && m.env.filter((key) => key.endsWith("_API_KEY")).every((key) => process.env[key]);
    })
    .map((m) => ({ id: m.id, manifest: m, make: () => registry.instantiate(port, m.id, {}, blob) }));
}

describe("BlobStore", () => {
  for (const p of providersFor("BlobStore")) {
    it(`${p.id}: put/get round-trips bytes and url is absolute`, async () => {
      const store = p.make();
      const bytes = new TextEncoder().encode("hello");
      const ref = await store.put("contracts/hello.txt", bytes, "text/plain");
      expect(ref.key).toBe("contracts/hello.txt");
      expect(await store.get(ref)).toEqual(bytes);
      expect(await store.url(ref)).toMatch(/^https?:\/\//);
    });
    it(`${p.id}: rejects path traversal`, async () => {
      const store = p.make();
      await expect(store.put("../escape.txt", new Uint8Array(1), "text/plain")).rejects.toThrow();
    });
  }
});

describe("IdeaSource", () => {
  for (const p of providersFor("IdeaSource")) {
    it(`${p.id}: discover returns valid NewIdea[]`, async () => {
      const ideas = await p.make().discover({ limit: 5 });
      expect(Array.isArray(ideas)).toBe(true);
      for (const i of ideas) expect(() => NewIdea.parse(i)).not.toThrow();
    });
  }
});

describe("TextModel", () => {
  // Concrete item schema: OpenAI strict json_schema rejects untyped (z.any) items.
  const Out = z.object({
    summary: z.string(),
    angle: z.string(),
    evidence: z.array(z.object({ url: z.string(), quote: z.string() })),
    sources: z.array(z.string()),
  });
  for (const p of providersFor("TextModel")) {
    it(`${p.id}: generate returns data matching the schema`, async () => {
      const out = await p.make().generate(Out, {
        kind: "brief",
        user: "brief me",
        context: { idea: { title: "Honey never spoils", oneLiner: "x", sourceUrl: "https://a.example/1", evidence: [] } },
      });
      expect(out.summary.length).toBeGreaterThan(0);
      expect(out.sources.length).toBeGreaterThan(0);
    });
    // A real model can satisfy { mustBeNumber: number }. Only fakes are forced to miss.
    if (!p.manifest.fake) continue;
    it(`${p.id}: throws when output cannot satisfy the schema`, async () => {
      const Impossible = z.object({ mustBeNumber: z.number() });
      await expect(p.make().generate(Impossible, { kind: "other", user: "x" })).rejects.toThrow();
    });
  }
});

describe("WebResearch", () => {
  for (const p of providersFor("WebResearch")) {
    it(`${p.id}: search returns urls; fetch returns text`, async () => {
      const r = p.make();
      const hits = await r.search("great emu war");
      expect(hits.length).toBeGreaterThan(0);
      for (const h of hits) expect(h.url).toMatch(/^https?:\/\//);
      expect((await r.fetch(hits[0]!.url)).length).toBeGreaterThan(0);
    });
  }
});

describe("Speech", () => {
  for (const p of providersFor("Speech")) {
    it(`${p.id}: synthesize returns audio bytes and monotonic words when present`, async () => {
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "default";
      const out = await p.make().synthesize("one two three four", { voiceId });
      expect(out.audio.byteLength).toBeGreaterThan(44);
      expect(out.contentType).toMatch(/^audio\//);
      if (out.words) {
        expect(out.words.length).toBe(4);
        assertMonotonic(out.words);
      }
    });
  }
});

describe("Aligner", () => {
  for (const p of providersFor("Aligner")) {
    if (p.manifest.fake) {
      it(`${p.id}: align returns one word per token, monotonic`, async () => {
        const tts = registry.instantiate("Speech", "fake-tts", {}, blob);
        const { audio } = await tts.synthesize("alpha beta gamma", { voiceId: "default" });
        const words = await p.make().align(audio, "alpha beta gamma");
        expect(words.map((w) => w.text)).toEqual(["alpha", "beta", "gamma"]);
        assertMonotonic(words);
      });
    } else if (includeReal && p.id === "align-elevenlabs") {
      it(`${p.id}: aligns audio synthesized by tts-elevenlabs`, async () => {
        const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "default";
        const synth = await registry.instantiate("Speech", "tts-elevenlabs", {}, blob).synthesize("alpha beta gamma", { voiceId });
        const words = await p.make().align(synth.audio, "alpha beta gamma");
        expect(words.map((w) => w.text)).toEqual(["alpha", "beta", "gamma"]);
        assertMonotonic(words);
      });
    }
  }
});

describe("StockSearch", () => {
  for (const p of providersFor("StockSearch")) {
    it(`${p.id}: search returns Assets with attribution; fetch returns bytes`, async () => {
      const s = p.make();
      const hits = await s.search("ocean waves", { orientation: "portrait", perPage: 1 });
      expect(hits.length).toBeGreaterThan(0);
      for (const a of hits) {
        expect(() => Asset.parse(a)).not.toThrow();
        expect(a.attribution.text.length).toBeGreaterThan(0);
      }
      expect((await s.fetch(hits[0]!)).byteLength).toBeGreaterThan(0);
    });
  }
});

describe("ImageGen", () => {
  for (const p of providersFor("ImageGen")) {
    it(`${p.id}: generate stores an image Asset in the blob store`, async () => {
      const a = await p.make().generate("a lighthouse at dusk", { style: "flat-illustration" });
      expect(() => Asset.parse(a)).not.toThrow();
      expect(a.kind).toBe("image");
      expect((await blob.get(a.blob)).byteLength).toBeGreaterThan(0);
    });
  }
});

describe("ClipGen", () => {
  for (const p of providersFor("ClipGen")) {
    it(`${p.id}: generate stores a synthetic video Asset`, async () => {
      const a = await p.make().generate("waves crashing", 3, {});
      expect(() => Asset.parse(a)).not.toThrow();
      expect(a.kind).toBe("video");
      expect(a.synthetic).toBe(true);
      expect((await blob.get(a.blob)).byteLength).toBeGreaterThan(0);
    });
  }
});

describe("Renderer", () => {
  // render-remotion is covered by the e2e test; it takes a minute and needs Chromium.
  for (const p of providersFor("Renderer").filter((x) => x.id !== "render-remotion")) {
    it(`${p.id}: render returns a Render whose blob exists`, async () => {
      const storyboard: Storyboard = {
        id: "sb1",
        projectId: "p1",
        narrationId: "n1",
        version: 1,
        scenes: [{ beatId: "b1", start: 0, end: 2, visual: { kind: "type" } }],
        containsSyntheticMedia: false,
        provider: "test",
        createdAt: new Date().toISOString(),
      };
      const audio = await blob.put("contracts/a.wav", new Uint8Array(44), "audio/wav");
      const r = await p.make().render({
        storyboard,
        bundle: {},
        template: { id: "fact-short", version: "0.1.0" },
        narration: { audioBlob: audio, words: [], durationSec: 2 },
        title: "t",
        beats: { b1: "hello" },
        projectId: "p1",
      });
      expect(() => Render.parse(r)).not.toThrow();
      expect((await blob.get(r.blob)).byteLength).toBeGreaterThan(0);
    });
  }
});

describe("Publisher", () => {
  for (const p of providersFor("Publisher")) {
    it(`${p.id}: upload is private by request, setPrivacy flips it, status reads back`, async () => {
      const pub = p.make();
      const render = Render.parse({
        id: "r1",
        projectId: "p1",
        storyboardId: "sb1",
        templateId: "fact-short",
        templateVersion: "0.1.0",
        blob: { key: "x.mp4", contentType: "video/mp4" },
        durationSec: 5,
        width: 1080,
        height: 1920,
        fps: 30,
        provider: "fake-render",
        createdAt: new Date().toISOString(),
      });
      let bytes = new Uint8Array([0, 0, 0, 24]);
      if (p.id === "publish-youtube") {
        const file = process.env.YOUTUBE_CONTRACT_FILE;
        if (!file) throw new Error("YOUTUBE_CONTRACT_FILE must point at a short mp4");
        bytes = new Uint8Array(readFileSync(file));
      }
      const blobRef = await blob.put(`contracts/${p.id}-upload.mp4`, bytes, "video/mp4");
      const meta = { title: "vcp contract test", description: "Automated contract test upload.", tags: [], containsSyntheticMedia: false };
      const up = await pub.upload({ ...render, blob: blobRef }, meta, "private");
      expect(() => Upload.parse(up)).not.toThrow();
      expect(up.privacy).toBe("private");
      // A real channel never gets a public test video: exercise the privacy change with
      // "unlisted" on YouTube, and always put it back to private afterwards.
      const target = p.id === "publish-youtube" ? "unlisted" : "public";
      let passed = false;
      try {
        const changed = await pub.setPrivacy(up, target);
        expect(changed.privacy).toBe(target);
        expect((await pub.status(changed)).privacy).toBe(target);
        passed = true;
      } finally {
        if (p.id === "publish-youtube") {
          try {
            await pub.setPrivacy(up, "private");
          } catch (err) {
            console.error(`could not restore ${up.remoteId} to private`, err);
            // Surface a failed restore, but never mask the assertion that failed above.
            if (passed) throw err;
          }
        }
      }
    });
  }
});

describe("manifests", () => {
  it("every manifest declares a known port and a fake exists for each port", () => {
    const ports = new Set(registry.manifests().map((m) => m.port));
    for (const port of ports) {
      const hasFake = registry.manifestsFor(port).some((m) => m.fake || m.id === "blob-local");
      expect(hasFake, `no fake for ${port}`).toBe(true);
    }
  });
});

function assertMonotonic(words: Word[]) {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    expect(w.end).toBeGreaterThanOrEqual(w.start);
    if (i) expect(w.start).toBeGreaterThanOrEqual(words[i - 1]!.start);
  }
}
