import type { ReactNode } from "react";

export type RunStatus = "pending" | "running" | "waiting" | "done" | "failed";
export type Tone = "neutral" | "muted" | "running" | "waiting" | "done" | "failed";
export type IconName =
  | "check"
  | "x"
  | "pause"
  | "pending"
  | "running"
  | "dot"
  | "star"
  | "play"
  | "download"
  | "external"
  | "chevron"
  | "plus"
  | "search"
  | "restore"
  | "log"
  | "alert"
  | "clock"
  | "copy"
  | "arrow"
  | "web"
  | "edit";

/** One pipeline stage as the strip and rail draw it. Built by `toStageRuns`, which covers every stage. */
export interface StageRun {
  key: string;
  label: string;
  gate: boolean;
  status: RunStatus;
  provider?: string;
  duration?: string;
  attempt?: number;
  logsHref?: string;
  error?: string;
}

export interface MetaItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
  /** `true` copies the value as text; a string copies that string instead. */
  copy?: boolean | string;
}
