import { defineManifest, type ProviderContext, type SearchResult, type WebResearch } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-research",
  port: "WebResearch",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  fake: true,
  description: "Canned search results and page text. Always returns a second, independent source.",
});

function slug(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function create(_ctx: ProviderContext): WebResearch {
  return {
    id: manifest.id,
    async search(q): Promise<SearchResult[]> {
      const s = slug(q) || "topic";
      return [
        {
          url: `https://www.britannica.com/topic/${s}`,
          title: `${q} | Britannica`,
          snippet: `${q}: a concise encyclopaedic account with dates, figures and the primary sources historians rely on.`,
        },
        {
          url: `https://www.smithsonianmag.com/history/${s}`,
          title: `The surprising story of ${q}`,
          snippet: `Contemporary accounts of ${q} describe details that rarely make it into the popular retelling.`,
        },
      ];
    },
    async fetch(url) {
      return `# Fetched page\n\nThis is fake page text for ${url}. It contains a paragraph of context, a quotation that can be lifted as evidence, and a closing line.`;
    },
  };
}
