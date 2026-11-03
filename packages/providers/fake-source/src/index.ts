import { defineManifest, type IdeaSource, type NewIdea, type ProviderContext } from "@vcp/core";

export const manifest = defineManifest({
  id: "fake-source",
  port: "IdeaSource",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  fake: true,
  description: "Deterministic canned ideas for tests and dry runs. Stands in for web discovery until real sources land.",
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
        quote:
          "The emu war... was a nuisance wildlife management military operation undertaken in Australia over the later part of 1932.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.92,
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
    score: 0.88,
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Octopus",
    title: "Octopuses have three hearts",
    oneLiner: "Two pump blood to the gills; the third pumps it to the rest of the body.",
    whySurprising: "A single animal runs three circulatory pumps, and one stops when it swims.",
    domain: "nature",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Octopus",
        quote: "An octopus has three hearts... the systemic heart... stops beating when the octopus swims.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.81,
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Cleopatra",
    title: "Cleopatra lived closer to the iPhone than to the pyramids",
    oneLiner: "The Great Pyramid was finished ~2,500 years before Cleopatra; she died in 30 BCE.",
    whySurprising: "Ancient Egypt lasted so long that its own queens are nearer to us than to its monuments.",
    domain: "history",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Cleopatra",
        quote: "Cleopatra VII Philopator was Queen of the Ptolemaic Kingdom of Egypt from 51 to 30 BC.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.9,
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Bananas",
    title: "Bananas are berries; strawberries aren't",
    oneLiner: "Botanically, a berry develops from one flower with one ovary — bananas qualify, strawberries don't.",
    whySurprising: "Everyday fruit names disagree with the botanical definition.",
    domain: "science",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Berry",
        quote: "In botanical language, a berry is a simple fleshy fruit that usually has many seeds.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.76,
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Oxford_University",
    title: "Oxford is older than the Aztec Empire",
    oneLiner: "Teaching at Oxford began by 1096; Tenochtitlan was founded in 1325.",
    whySurprising: "A living university predates an empire most people think of as ancient.",
    domain: "history",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/University_of_Oxford",
        quote: "There is evidence of teaching as early as 1096, making it the oldest university in the English-speaking world.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.84,
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Sharks",
    title: "Sharks are older than trees",
    oneLiner: "Shark fossils date to ~450 million years ago; trees appear around 350 million.",
    whySurprising: "Cartilaginous hunters cruised oceans long before forests existed.",
    domain: "nature",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Shark",
        quote: "Sharks are a group of elasmobranch fish... dating back to more than 400 million years ago.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.87,
  },
  {
    origin: "research",
    sourceProvider: "fake-source",
    sourceUrl: "https://en.wikipedia.org/wiki/Space_Pen",
    title: "The US did not spend millions inventing a space pen while Soviets used pencils",
    oneLiner: "A private inventor funded the pressurized pen; NASA and the Soviets both bought it later.",
    whySurprising: "The viral story reverses who paid and who used what.",
    domain: "technology",
    evidence: [
      {
        url: "https://en.wikipedia.org/wiki/Space_Pen",
        quote: "The Fisher Space Pen was invented by Paul C. Fisher... Fisher independently developed it with about $1 million of his own money.",
      },
    ],
    opinion: false,
    status: "new",
    score: 0.79,
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
