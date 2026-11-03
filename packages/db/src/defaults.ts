import type { PortName } from "@vcp/core";

/** M0 default bindings: every port on a fake except the renderer and the blob store. */
export const DEFAULT_PORT_BINDINGS: Record<PortName, { providerId: string; options?: Record<string, unknown> }> = {
  IdeaSource: { providerId: "fake-source" },
  TextModel: { providerId: "fake-llm" },
  WebResearch: { providerId: "fake-research" },
  Speech: { providerId: "fake-tts" },
  Aligner: { providerId: "fake-align" },
  StockSearch: { providerId: "fake-stock" },
  ImageGen: { providerId: "fake-image" },
  ClipGen: { providerId: "fake-clip" },
  Renderer: { providerId: "render-remotion" },
  Publisher: { providerId: "fake-publish" },
  BlobStore: { providerId: "blob-local" },
};
