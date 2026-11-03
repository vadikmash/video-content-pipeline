import type { ZodType } from "zod";
import {
  defineManifest,
  type Beat,
  type BriefDraft,
  type Prompt,
  type ProviderContext,
  type ScriptDraft,
  type StoryboardDraft,
  type TextModel,
  type VisualIntent,
} from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-llm",
  port: "TextModel",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "token", approxUsd: 0 },
  fake: true,
  description: "Canned structured outputs keyed by prompt.kind; validated against the requested schema.",
});

// ---------------------------------------------------------------------------
// Fixture builders. They read `prompt.context` loosely so the pipeline can pass
// whatever it has; missing fields fall back to generic text.
// ---------------------------------------------------------------------------

type Ctx = Record<string, unknown>;

function str(ctx: Ctx, pathStr: string, fallback: string): string {
  let cur: unknown = ctx;
  for (const part of pathStr.split(".")) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" && cur.length ? cur : fallback;
}

function urls(ctx: Ctx): string[] {
  const out = new Set<string>();
  const idea = ctx.idea as { sourceUrl?: string; evidence?: { url: string }[] } | undefined;
  if (idea?.sourceUrl) out.add(idea.sourceUrl);
  for (const e of idea?.evidence ?? []) out.add(e.url);
  const research = ctx.research as { url: string }[] | undefined;
  for (const r of research ?? []) out.add(r.url);
  if (!out.size) out.add("https://example.org/source");
  return [...out];
}

export function briefFixture(ctx: Ctx): BriefDraft {
  const title = str(ctx, "idea.title", "An unexpected fact");
  const oneLiner = str(ctx, "idea.oneLiner", "Something most people have never heard.");
  const sources = urls(ctx);
  const research = (ctx.research as { url: string; title: string; snippet: string }[] | undefined) ?? [];
  return {
    summary: `${title}. ${oneLiner}`,
    angle: `Open on the surprise, then explain why it happened, then land on what it tells us today.`,
    evidence: [
      ...(((ctx.idea as { evidence?: { url: string; quote: string }[] } | undefined)?.evidence) ?? []),
      ...research.map((r) => ({ url: r.url, quote: r.snippet, title: r.title })),
    ].slice(0, 6),
    sources,
  };
}

export function scriptFixture(ctx: Ctx): ScriptDraft {
  const title = str(ctx, "idea.title", "An unexpected fact");
  const oneLiner = str(ctx, "idea.oneLiner", "Something most people have never heard.");
  const why = str(ctx, "idea.whySurprising", "It runs against what we expect.");
  const sources = urls(ctx);
  const src = (i: number) => sources[i % sources.length]!;
  const visuals: VisualIntent[] = [
    { kind: "type" },
    { kind: "stock", query: title.toLowerCase(), orientation: "portrait" },
    { kind: "still", prompt: `stylised illustration of ${title.toLowerCase()}`, style: "flat-illustration" },
    { kind: "type" },
  ];
  const texts = [
    `${title}. That is not a joke.`,
    oneLiner,
    `Why does this matter? ${why}`,
    `Next time someone tells you the obvious answer is the right one, remember this.`,
  ];
  const beats: Beat[] = texts.map((text, i) => ({ id: `beat-${i + 1}`, text, visual: visuals[i]! }));
  const allText = [texts[0], ...texts.slice(1), "Sources in the description."].join(" ");
  const words = allText.split(/\s+/).length;
  return {
    hook: `Here is a fact that sounds made up: ${title.toLowerCase()}.`,
    beats,
    outro: "Sources in the description. Follow for one surprising fact a day.",
    estimatedSeconds: Math.round((words / 2.6) * 10) / 10,
    claims: [
      { text: oneLiner, sourceUrl: src(0), confidence: 0.9 },
      { text: why, sourceUrl: src(1), confidence: 0.7 },
    ],
  };
}

export function storyboardFixture(ctx: Ctx): StoryboardDraft {
  const timings = (ctx.beatTimings as { beatId: string; start: number; end: number; visual: VisualIntent }[] | undefined) ?? [];
  if (!timings.length) {
    return { scenes: [{ beatId: "beat-1", start: 0, end: 5, visual: { kind: "type" } }] };
  }
  return { scenes: timings.map((t) => ({ beatId: t.beatId, start: t.start, end: t.end, visual: t.visual })) };
}

export function scoreFixture(ctx: Ctx) {
  const title = str(ctx, "idea.title", "");
  // Deterministic pseudo-score from the title so repeated runs agree.
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 1000;
  const base = 0.5 + h / 2000;
  return {
    surprise: round(base),
    sourceability: round(Math.min(1, base + 0.1)),
    showability: round(Math.max(0, base - 0.1)),
    total: round(base),
    rationale: "fake-llm deterministic score",
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function fixtureFor(prompt: Prompt): unknown {
  const ctx = prompt.context ?? {};
  switch (prompt.kind) {
    case "brief":
      return briefFixture(ctx);
    case "script":
      return scriptFixture(ctx);
    case "storyboard":
      return storyboardFixture(ctx);
    case "score":
      return scoreFixture(ctx);
    default:
      return { text: `fake-llm response to: ${prompt.user.slice(0, 80)}` };
  }
}

export function create(_ctx: ProviderContext): TextModel {
  return {
    id: manifest.id,
    async generate<T>(schema: ZodType<T>, prompt: Prompt): Promise<T> {
      return schema.parse(fixtureFor(prompt));
    },
  };
}
