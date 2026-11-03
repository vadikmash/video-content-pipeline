import { defineManifest, type IdeaSource, type ProviderContext } from "@vcp/core";

export const manifest = defineManifest({
  id: "source-manual",
  port: "IdeaSource",
  env: [],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  description: "Ideas entered by hand in the dashboard. discover() has nothing to add.",
});

export function create(_ctx: ProviderContext): IdeaSource {
  return {
    id: manifest.id,
    async discover() {
      return [];
    },
  };
}
