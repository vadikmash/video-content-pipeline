import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BriefDraft, ScriptDraft } from "./schemas";
import { parseWithOneRetry, promptText, strictJsonSchema } from "./llm";

describe("strictJsonSchema", () => {
  it("closes objects and rewrites keywords OpenAI strict mode rejects", () => {
    const brief = strictJsonSchema(BriefDraft);
    const script = strictJsonSchema(ScriptDraft);
    const encoded = JSON.stringify({ brief, script });
    expect(encoded).not.toContain("oneOf");
    expect(encoded).not.toContain("\"const\"");
    expect(encoded).not.toContain("\"format\"");
    expect(encoded).not.toContain("minLength");
    expect(encoded).not.toContain("$ref");
    const evidence = (brief.properties as { evidence: { items: { required: string[] } } }).evidence;
    expect(evidence.items.required).toContain("title");
    expect(walkObjectsClosed(script)).toBe(true);
    expect(walkObjectsClosed(brief)).toBe(true);
  });
});

describe("promptText", () => {
  it("appends context JSON so a real model can see it", () => {
    const { system, user } = promptText({
      kind: "script",
      system: "Be brief.",
      user: "Write it.",
      context: { idea: { title: "Emus" } },
    });
    expect(system).toBe("Be brief.");
    expect(user).toContain("Write it.");
    expect(user).toContain("\"title\":\"Emus\"");
  });
});

describe("parseWithOneRetry", () => {
  const schema = z.object({ n: z.number() });

  it("retries once when the first payload misses the schema", async () => {
    let calls = 0;
    const out = await parseWithOneRetry(schema, "go", async (user) => {
      calls++;
      if (calls === 1) return { n: "no" };
      expect(user).toContain("failed validation");
      return { n: 1 };
    });
    expect(out).toEqual({ n: 1 });
    expect(calls).toBe(2);
  });

  it("throws after a second miss and does not retry a thrown call", async () => {
    await expect(parseWithOneRetry(schema, "go", async () => ({ n: "no" }))).rejects.toThrow(/schema/);
    let calls = 0;
    await expect(
      parseWithOneRetry(schema, "go", async () => {
        calls++;
        throw new Error("http 500");
      }),
    ).rejects.toThrow(/http 500/);
    expect(calls).toBe(1);
  });
});

function walkObjectsClosed(node: unknown): boolean {
  if (Array.isArray(node)) return node.every(walkObjectsClosed);
  if (!node || typeof node !== "object") return true;
  const obj = node as Record<string, unknown>;
  if (obj.type === "object" && obj.additionalProperties !== false) return false;
  return Object.values(obj).every(walkObjectsClosed);
}
