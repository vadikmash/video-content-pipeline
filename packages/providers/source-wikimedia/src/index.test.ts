import { readFileSync } from "node:fs";
import { NewIdea, ProviderError } from "@vcp/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { create, feedPath, userAgent } from "./index";

// Trimmed copy of https://en.wikipedia.org/api/rest_v1/feed/featured/2026/11/27
// (Wikipedia text, CC BY-SA 4.0).
const fixture = JSON.parse(readFileSync(new URL("./fixtures/featured-2026-11-27.json", import.meta.url), "utf8"));

function source(options: Record<string, unknown> = { date: "2026-11-27" }, env: Record<string, string> = {}) {
  return create({ options, env, blob: undefined as never });
}

function stubFetch(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("source-wikimedia", () => {
  it("zero-pads the feed date", () => {
    expect(feedPath("2026-03-07")).toBe("2026/03/07");
    expect(feedPath("2026-11-27")).toBe("2026/11/27");
    expect(() => feedPath("2026-13-01")).toThrow(ProviderError);
  });

  it("requests the zero-padded feed with a descriptive User-Agent and a generic contact", async () => {
    const fetch = stubFetch(fixture);
    await source({ date: "2026-03-07" }, { WIKIMEDIA_CONTACT: "ops@example.org" }).discover({});
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://en.wikipedia.org/api/rest_v1/feed/featured/2026/03/07");
    const agent = (init!.headers as Record<string, string>)["User-Agent"];
    expect(agent).toMatch(/^vcp-idea-discovery\/\S+ \(.*ops@example\.org\)$/);
    expect(userAgent()).toContain("https://");
  });

  it("turns hooks and anniversaries into valid ideas with CC BY-SA evidence", async () => {
    stubFetch(fixture);
    const ideas = await source().discover({});
    expect(ideas).toHaveLength(6);
    for (const idea of ideas) {
      expect(() => NewIdea.parse(idea)).not.toThrow();
      expect(idea.sourceProvider).toBe("source-wikimedia");
      expect(idea.evidence.length).toBeGreaterThan(0);
      for (const e of idea.evidence) expect(e.title).toContain("CC BY-SA 4.0");
    }

    const warehouse = ideas.find((i) => i.title.includes("warehouse"))!;
    expect(warehouse.title).toBe("A newly sold Manhattan warehouse needed seven months to thaw out before it could be used");
    expect(warehouse.sourceUrl).toBe("https://en.wikipedia.org/wiki/Merchants_Refrigerating_Company_Warehouse");
    expect(warehouse.evidence[0]!.title).toContain("Merchants Refrigerating Company Warehouse");

    // The hook's bold link (the opera), not the first link (the composer).
    const opera = ideas.find((i) => i.title.includes("Athaliah"))!;
    expect(opera.sourceUrl).toBe("https://en.wikipedia.org/wiki/Athaliah_(opera)");

    // "Korean War: ..." is context; the article is the battle.
    const korea = ideas.find((i) => i.title.startsWith("1950:"))!;
    expect(korea.sourceUrl).toBe("https://en.wikipedia.org/wiki/Battle_of_Chosin_Reservoir");
    expect(korea.evidence[0]!.url).toBe("https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries/November_27");
    expect(korea.whySurprising).toContain("76 years ago");

    const fauld = ideas.find((i) => i.title.startsWith("1944:"))!;
    expect(fauld.sourceUrl).toBe("https://en.wikipedia.org/wiki/RAF_Fauld_explosion");
  });

  it("alternates feeds and honours the limit", async () => {
    stubFetch(fixture);
    const ideas = await source().discover({ limit: 2 });
    expect(ideas.map((i) => i.evidence[0]!.quote.startsWith("Did you know"))).toEqual([true, false]);
  });

  it("can be limited to one feed", async () => {
    stubFetch(fixture);
    const ideas = await source({ date: "2026-11-27", feeds: ["onthisday"] }).discover({});
    expect(ideas).toHaveLength(3);
    expect(ideas.every((i) => /^\d{4}: /.test(i.title))).toBe(true);
  });

  it("throws ProviderError with the status so a 4xx is not retried", async () => {
    stubFetch({ title: "Not found" }, 404);
    await expect(source().discover({})).rejects.toMatchObject({ name: "ProviderError", status: 404 });
  });
});
