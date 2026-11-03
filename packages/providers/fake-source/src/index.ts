import { defineManifest, type IdeaSource, type NewIdea, type ProviderContext } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-source",
  port: "IdeaSource",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  fake: true,
  description: "Deterministic canned ideas for tests and dry runs.",
});

export const FAKE_IDEAS: NewIdea[] = [
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Great_Emu_War",
    title: "Australia lost a war against emus",
    oneLiner: "In 1932 the Australian army deployed machine guns against 20,000 emus and withdrew.",
    whySurprising: "A modern military was outmanoeuvred by flightless birds.",
    domain: "history",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Great_Emu_War",
        quote: "The emu war... was a nuisance wildlife management military operation undertaken in Australia over the later part of 1932.",
      },
    ],
    opinion: false,
    status: "new",
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Honey",
    title: "Honey never spoils",
    oneLiner: "Edible honey has been found in Egyptian tombs more than 3,000 years old.",
    whySurprising: "A food with effectively no expiry date.",
    domain: "science",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Honey",
        quote: "Honey has a long shelf life... sealed honey does not spoil, even after thousands of years.",
      },
    ],
    opinion: false,
    status: "new",
  },
];

export function create(_ctx: ProviderContext): IdeaSource {
  return {
    id: manifest.id,
    async discover(ctx) {
      return FAKE_IDEAS.slice(0, ctx.limit ?? FAKE_IDEAS.length);
    },
  };
}
