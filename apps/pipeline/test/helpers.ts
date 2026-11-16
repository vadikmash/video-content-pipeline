import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NewIdea, PipelineConfig } from "@vcp/core";
import { allFakesConfig, createRegistry } from "@vcp/providers";
import { MemoryStore } from "../src/store/memory";

export const EMU_IDEA: NewIdea = {
  origin: "manual",
  sourceProvider: "source-manual",
  sourceUrl: "https://en.wikipedia.org/wiki/Great_Emu_War",
  title: "Australia lost a war against emus",
  oneLiner: "In 1932 the Australian army deployed machine guns against 20,000 emus and withdrew.",
  whySurprising: "A modern military was outmanoeuvred by flightless birds.",
  domain: "history",
  evidence: [
    { url: "https://en.wikipedia.org/wiki/Great_Emu_War", quote: "The emu war was a nuisance wildlife management military operation." },
    { url: "https://www.awm.gov.au/articles/encyclopedia/emu-war", quote: "The army withdrew after the emus outlasted the operation." },
  ],
  opinion: false,
  status: "new",
};

export function makeWorld(overrides: Partial<PipelineConfig["ports"]> = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vcp-e2e-"));
  const config = allFakesConfig({ BlobStore: { providerId: "blob-local", options: { dir } }, ...overrides });
  const store = new MemoryStore(config);
  const registry = createRegistry();
  const idea = store.addIdea(EMU_IDEA);
  const project = store.addProject(idea.id);
  return {
    dir,
    config,
    store,
    registry,
    idea,
    project,
    deps: { store, registry },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
