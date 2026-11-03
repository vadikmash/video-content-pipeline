import { cx } from "./format";
import { Icon } from "./Icon";
import type { IconName, Tone } from "./types";

type Spec = [Tone, IconName, string];

const STATUS = {
  stage: {
    pending: ["muted", "pending", "Pending"],
    running: ["running", "running", "Running"],
    waiting: ["waiting", "pause", "Paused for you"],
    done: ["done", "check", "Done"],
    failed: ["failed", "x", "Failed"],
  },
  project: {
    active: ["running", "running", "Active"],
    waiting: ["waiting", "pause", "Waiting on you"],
    published: ["done", "check", "Published"],
    rejected: ["muted", "x", "Rejected"],
    failed: ["failed", "alert", "Failed"],
  },
  idea: {
    new: ["neutral", "dot", "New"],
    shortlisted: ["neutral", "star", "Shortlisted"],
    selected: ["running", "arrow", "Selected"],
    done: ["done", "check", "Done"],
    rejected: ["muted", "x", "Rejected"],
  },
  claim: {
    sourced: ["done", "check", "Sourced"],
    unsourced: ["failed", "alert", "Unsourced"],
    opinion: ["waiting", "dot", "Opinion"],
  },
  privacy: {
    private: ["neutral", "dot", "Private"],
    unlisted: ["neutral", "dot", "Unlisted"],
    public: ["done", "check", "Public"],
  },
} satisfies Record<string, Record<string, Spec>>;

export type StatusKind = keyof typeof STATUS;

function statusOf(kind: StatusKind, status: string): Spec {
  const table: Record<string, Spec> = STATUS[kind];
  return table[status] ?? ["neutral", "dot", status];
}

export interface StatusBadgeProps {
  kind?: StatusKind;
  status: string;
  size?: "sm" | "md";
  label?: string;
  bare?: boolean;
  className?: string;
}

export function StatusBadge({ kind = "stage", status, size, label, bare, className }: StatusBadgeProps) {
  const [tone, icon, word] = statusOf(kind, status);
  const sm = size === "sm";
  return (
    <span className={cx("vcp-status", `vcp-tone-${tone}`, sm && "vcp-status--sm", bare && "vcp-status--bare", className)}>
      <Icon name={icon} size={sm ? 12 : 14} stroke={2.25} className={icon === "running" ? "vcp-spin" : undefined} />
      <span>{label ?? word}</span>
    </span>
  );
}

export function stageWord(status: string): string {
  return statusOf("stage", status)[2];
}

export function stageIcon(status: string): IconName {
  return statusOf("stage", status)[1];
}
