import type { PortName } from "./ports";

/**
 * Ordered pipeline stages after an idea is selected (tech-plan section 4).
 * Gates are stages whose work is a human decision; the stage after a gate
 * runs once the gate's approval event arrives (or immediately when auto).
 */
export const STAGES = [
  "research",
  "write",
  "approve-script",
  "voice",
  "storyboard",
  "assets",
  "render",
  "approve-video",
  "upload",
  "approve-publish",
  "publish",
] as const;
export type StageName = (typeof STAGES)[number];

export const GATES = ["approve-script", "approve-video", "approve-publish"] as const;
export type GateName = (typeof GATES)[number];

export type GateMode = "auto" | "manual";

export const DEFAULT_GATE_MODES: Record<GateName, GateMode> = {
  "approve-script": "manual",
  "approve-video": "manual",
  "approve-publish": "manual",
};

/** The event each gate waits for when manual. */
export const GATE_EVENTS = {
  "approve-script": "script.approved",
  "approve-video": "render.approved",
  "approve-publish": "upload.publish",
} as const satisfies Record<GateName, string>;

export function isGate(stage: string): stage is GateName {
  return (GATES as readonly string[]).includes(stage);
}

export function stageIndex(stage: StageName): number {
  return STAGES.indexOf(stage);
}

export function nextStage(stage: StageName): StageName | undefined {
  return STAGES[stageIndex(stage) + 1];
}

export function previousStage(stage: StageName): StageName | undefined {
  const i = stageIndex(stage);
  return i > 0 ? STAGES[i - 1] : undefined;
}

/** Ports each work stage calls; used for the stage rail and the idempotency hash. */
export const STAGE_PORTS: Record<StageName, readonly PortName[]> = {
  research: ["WebResearch", "TextModel"],
  write: ["TextModel"],
  "approve-script": [],
  voice: ["Speech", "Aligner"],
  storyboard: ["TextModel"],
  assets: ["StockSearch", "ImageGen", "ClipGen"],
  render: ["Renderer"],
  "approve-video": [],
  upload: ["Publisher"],
  "approve-publish": [],
  publish: ["Publisher"],
};
