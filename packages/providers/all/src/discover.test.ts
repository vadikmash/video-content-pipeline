import { newId, nowIso, type Idea, type IdeaSource, type NewIdea } from "@vcp/core";
import { FAKE_IDEAS } from "@vcp/provider-fake-source";
import { describe, expect, it } from "vitest";
import { dedupeKey, resolveSource, runDiscovery } from "./discover";

/** In-memory inbox with the same unique-key behaviour as the ideas table. */
function inbox(initial: Idea[] = []) {
  const rows = [...initial];
  const keys = new Set<string>();
  return {
    rows,
    listIdeas: async () => [...rows],
    insertIdeaIfNew: async (idea: NewIdea, key: string) => {
      if (keys.has(key)) return undefined;
      keys.add(key);
      const row = { ...idea, id: newId(), createdAt: nowIso(), status: idea.status ?? "new" } as Idea;
      rows.push(row);
      return row;
    },
  };
}

describe("runDiscovery", () => {
  it("adds new ideas and skips them on the next run", async () => {
    const db = inbox();
    const first = await runDiscovery({ ...db, limit: 3 });
    expect(first).toMatchObject({ added: 3, skipped: 0, providerId: "fake-source" });
    const second = await runDiscovery({ ...db, limit: 3 });
    expect(second).toMatchObject({ added: 0, skipped: 3 });
    expect(db.rows).toHaveLength(3);
  });

  it("does not duplicate when two runs overlap", async () => {
    const db = inbox();
    // Both runs read the inbox before either inserts.
    const results = await Promise.all([runDiscovery({ ...db, limit: 4 }), runDiscovery({ ...db, limit: 4 })]);
    expect(db.rows).toHaveLength(4);
    expect(results.reduce((n, r) => n + r.added, 0)).toBe(4);
    expect(results.reduce((n, r) => n + r.skipped, 0)).toBe(4);
  });

  it("skips ideas already in the inbox by URL or title, including hand-added ones", async () => {
    const manual: Idea = {
      ...FAKE_IDEAS[1]!,
      id: newId(),
      origin: "manual",
      sourceUrl: undefined,
      createdAt: nowIso(),
      status: "shortlisted",
    };
    const legacy: Idea = {
      ...FAKE_IDEAS[0]!,
      id: newId(),
      // Same article, different spelling of the URL.
      sourceUrl: "http://EN.wikipedia.org/wiki/Great_Emu_War/?utm=x#History",
      createdAt: nowIso(),
      status: "rejected",
    };
    const db = inbox([manual, legacy]);
    const result = await runDiscovery({ ...db, limit: 3 });
    expect(result).toMatchObject({ added: 1, skipped: 2 });
  });

  it("collapses duplicates within one batch", async () => {
    const dupes: IdeaSource = { id: "dupes", discover: async () => [FAKE_IDEAS[0]!, FAKE_IDEAS[0]!] };
    const db = inbox();
    expect(await runDiscovery({ ...db, source: dupes })).toMatchObject({ added: 1, skipped: 1, providerId: "dupes" });
  });
});

describe("dedupeKey", () => {
  it("normalises URLs and falls back to the title", () => {
    expect(dedupeKey({ title: "x", sourceUrl: "https://en.wikipedia.org/wiki/Athaliah_(opera)" })).toBe(
      dedupeKey({ title: "y", sourceUrl: "https://en.wikipedia.org/wiki/Athaliah_%28opera%29" }),
    );
    expect(dedupeKey({ title: "  Honey  never spoils " })).toBe("title:honey never spoils");
  });
});

describe("resolveSource", () => {
  it("builds the bound lightweight source and rejects unknown ids", () => {
    expect(resolveSource({ providerId: "source-wikimedia" }).source.id).toBe("source-wikimedia");
    expect(resolveSource({ providerId: "source-manual" }).providerId).toBe("fake-source");
    expect(() => resolveSource({ providerId: "nope" })).toThrow(/Unknown IdeaSource/);
  });
});
