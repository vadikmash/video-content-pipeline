import { ProviderError, defineManifest, type Domain, type Evidence, type IdeaSource, type NewIdea, type ProviderContext } from "@vcp/core";
import { Deferred, limits, parseRetryAfter } from "@vcp/limits";
import { z } from "zod";

/**
 * Wikipedia's daily featured feed (Wikimedia REST API). One request per run returns the
 * main page's "Did you know" hooks and "On this day" anniversaries; both are editor-curated,
 * short and already linked to an article, which is what a factual Short needs to start from.
 *
 * Text is CC BY-SA 4.0. Every idea carries the article URL and a licence note in its
 * evidence so a later stage can credit it.
 */
export const manifest = defineManifest({
  id: "source-wikimedia",
  port: "IdeaSource",
  // WIKIMEDIA_CONTACT (optional) goes into the User-Agent; no key is needed.
  env: [],
  limits: { perMinute: 30, concurrency: 1 },
  attributionRequired: true,
  costModel: { unit: "request", approxUsd: 0 },
  description: "Wikipedia's daily \"Did you know\" hooks and \"On this day\" events from the Wikimedia featured feed.",
});

export const LICENCE = "CC BY-SA 4.0";
const VERSION = "0.1";

export const Options = z.object({
  /** Wikipedia language edition. "Did you know" only exists on some; en has both feeds. */
  lang: z.string().regex(/^[a-z][a-z-]{1,15}$/).default("en"),
  /** Feed date as YYYY-MM-DD (UTC). Defaults to today. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  feeds: z.array(z.enum(["dyk", "onthisday"])).min(1).default(["dyk", "onthisday"]),
});
export type Options = z.infer<typeof Options>;

const page = z.object({
  title: z.string(),
  titles: z.object({ normalized: z.string() }).partial().optional(),
  description: z.string().optional(),
  extract: z.string().optional(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }).optional(),
});
type Page = z.infer<typeof page>;

const FeaturedFeed = z.object({
  dyk: z.array(z.object({ html: z.string(), text: z.string() })).optional(),
  onthisday: z.array(z.object({ text: z.string(), year: z.number().int(), pages: z.array(page) })).optional(),
});
export type FeaturedFeed = z.infer<typeof FeaturedFeed>;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Wikimedia asks automated clients for a descriptive agent with a way to reach the operator. */
export function userAgent(contact?: string): string {
  const reach = contact?.trim() || "https://meta.wikimedia.org/wiki/User-Agent_policy";
  return `vcp-idea-discovery/${VERSION} (factual Shorts research tool; ${reach})`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Feed path for a date: zero-padded, as the REST API requires (`2026/03/07`, not `2026/3/7`). */
export function feedPath(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d || m > 12 || d > 31) throw new ProviderError(`Invalid feed date "${date}"`, 400);
  return `${String(y).padStart(4, "0")}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

const clean = (text: string) => text.replace(/\s*\((?:pictured|shown)\)/gi, "").replace(/\s+/g, " ").trim();
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** First sentences of an extract, up to roughly `max` characters. */
function excerpt(text: string, max = 320): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if (out && out.length + s.length > max) break;
    out += s;
  }
  return out.trim() || text.slice(0, max);
}

function attribution(articleTitle: string): string {
  return `"${articleTitle}" from Wikipedia, ${LICENCE}`;
}

function articleUrl(p: Page, lang: string): string {
  return p.content_urls?.desktop.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`;
}

/** The bolded link in a hook is the new or expanded article the hook comes from. */
function boldArticle(html: string): { url: string; title: string } | undefined {
  for (const bold of html.matchAll(/<b\b[^>]*>([\s\S]*?)<\/b>/g)) {
    const anchor = bold[1]!.match(/<a\b[^>]*>/);
    const href = anchor?.[0].match(/\bhref="([^"]+)"/)?.[1];
    if (!href) continue;
    const title = anchor![0].match(/\btitle="([^"]+)"/)?.[1];
    const url = decodeEntities(href);
    if (!URL.canParse(url)) continue;
    return { url, title: decodeEntities(title ?? decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url)) };
  }
}

export function dykIdeas(feed: FeaturedFeed, date: string): NewIdea[] {
  const ideas: NewIdea[] = [];
  for (const hook of feed.dyk ?? []) {
    const article = boldArticle(hook.html);
    const fact = clean(hook.text).replace(/^(?:\.\.\.|…)\s*that\s+/i, "").replace(/\?\s*$/, "").trim();
    if (!article || !fact) continue;
    const quote = `Did you know that ${fact}?`;
    ideas.push({
      origin: "research",
      sourceProvider: manifest.id,
      sourceUrl: article.url,
      title: capitalise(fact),
      oneLiner: `${capitalise(fact)}.`,
      whySurprising: `Picked as an unusual fact for Wikipedia's "Did you know" on ${date}.`,
      domain: "other",
      evidence: [{ url: article.url, quote, title: attribution(article.title) }],
      opinion: false,
      status: "new",
    });
  }
  return ideas;
}

/**
 * Choose the article an anniversary is about. Lead pages are often the broad context
 * ("Korean War: ...", "Sodium"), so skip a "Context:" prefix and score the rest:
 * an extract that states the exact date, a title with the year, then the longest
 * title quoted verbatim in the event text. Ties keep feed order.
 */
function eventPage(text: string, year: number, month: number, day: number, pages: Page[]): Page | undefined {
  const name = (p: Page) => p.titles?.normalized ?? p.title.replace(/_/g, " ");
  const context = text.includes(":") ? text.slice(0, text.indexOf(":")).trim().toLowerCase() : undefined;
  const candidates = pages.filter((p) => name(p).toLowerCase() !== context);
  const pool = candidates.length ? candidates : pages;
  const monthName = MONTHS[month - 1]!;
  const dates = [`${day} ${monthName} ${year}`, `${monthName} ${day}, ${year}`];
  const score = (p: Page) =>
    (dates.some((d) => p.extract?.includes(d)) ? 10 : 0) +
    (name(p).includes(String(year)) ? 8 : 0) +
    (text.includes(name(p)) ? name(p).split(/\s+/).length : 0);
  let best: Page | undefined;
  for (const p of pool) if (!best || score(p) > score(best)) best = p;
  return best;
}

function domainFor(text: string): Domain {
  if (/\b(planet|astronom|chemist|physic|scien|species|fossil|discover(?:ed|y) of)/i.test(text)) return "science";
  if (/\b(computers?|software|internet|satellites?|spacecraft|space probe)\b/i.test(text)) return "technology";
  return "history";
}

export function onThisDayIdeas(feed: FeaturedFeed, date: string, lang: string): NewIdea[] {
  const [y, m, d] = date.split("-").map(Number);
  const dayName = `${d} ${MONTHS[m! - 1]}`;
  const anniversaries = `https://${lang}.wikipedia.org/wiki/Wikipedia:Selected_anniversaries/${MONTHS[m! - 1]}_${d}`;
  const ideas: NewIdea[] = [];
  for (const event of feed.onthisday ?? []) {
    const text = clean(event.text);
    const p = eventPage(text, event.year, m!, d!, event.pages);
    if (!text || !p) continue;
    const url = articleUrl(p, lang);
    const title = p.titles?.normalized ?? p.title.replace(/_/g, " ");
    const evidence: Evidence[] = [
      { url: anniversaries, quote: `${event.year} – ${text}`, title: attribution(`Selected anniversaries/${dayName}`) },
    ];
    if (p.extract?.trim()) evidence.push({ url, quote: excerpt(p.extract), title: attribution(title) });
    const ago = y! - event.year;
    ideas.push({
      origin: "research",
      sourceProvider: manifest.id,
      sourceUrl: url,
      title: `${event.year}: ${text.replace(/\.$/, "")}`,
      oneLiner: `${text.replace(/\.$/, "")} (${dayName} ${event.year}).`,
      whySurprising: `Picked for Wikipedia's "On this day" for ${dayName}${ago > 0 ? `; it happened ${ago} years ago` : ""}.`,
      domain: domainFor(`${text} ${p.description ?? ""}`),
      evidence,
      opinion: false,
      status: "new",
    });
  }
  return ideas;
}

/** Hooks first, then anniversaries, alternating so a small limit gets both kinds. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]!);
    if (b[i]) out.push(b[i]!);
  }
  return out;
}

export function create(ctx: ProviderContext): IdeaSource {
  const options = Options.parse(ctx.options ?? {});
  const agent = userAgent(ctx.env.WIKIMEDIA_CONTACT);

  return {
    id: manifest.id,
    async discover(discoverCtx) {
      const date = options.date ?? todayUtc();
      const url = `https://${options.lang}.wikipedia.org/api/rest_v1/feed/featured/${feedPath(date)}`;
      await limits.acquire(manifest.id);
      const response = await fetch(url, {
        headers: { "User-Agent": agent, "Api-User-Agent": agent, Accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      }).catch(() => {
        throw new ProviderError("Wikimedia featured feed request failed");
      });
      const headers = Object.fromEntries(response.headers);
      await limits.observe(manifest.id, headers);
      if (response.status === 429) {
        const wait = parseRetryAfter(headers["retry-after"]) ?? 60_000;
        await limits.trip(manifest.id, new Date(Date.now() + wait), "Wikimedia rate limit reached");
        throw new Deferred(manifest.id, wait, "Wikimedia rate limit reached");
      }
      if (!response.ok) throw new ProviderError(`Wikimedia featured feed failed (HTTP ${response.status})`, response.status);
      const feed = FeaturedFeed.parse(await response.json());

      const dyk = options.feeds.includes("dyk") ? dykIdeas(feed, date) : [];
      const otd = options.feeds.includes("onthisday") ? onThisDayIdeas(feed, date, options.lang) : [];
      const ideas = interleave(dyk, otd);
      return ideas.slice(0, discoverCtx.limit ?? ideas.length);
    },
  };
}
