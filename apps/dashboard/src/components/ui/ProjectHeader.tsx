import type { ProjectStatus } from "@vcp/core";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./format";
import { StageStrip } from "./StageStrip";
import { currentIndex } from "./stages";
import { StatusBadge } from "./StatusBadge";
import type { StageRun } from "./types";

export interface ProjectHeaderProps {
  id: string;
  title: string;
  oneLiner?: string;
  status: ProjectStatus;
  stages: StageRun[];
  backHref?: string;
  live?: ReactNode;
  actions?: ReactNode;
  /** Extra tags beside the status, e.g. "dry run". */
  tags?: ReactNode;
  className?: string;
}

export function ProjectHeader({
  id,
  title,
  oneLiner,
  status,
  stages,
  backHref = "/projects",
  live,
  actions,
  tags,
  className,
}: ProjectHeaderProps) {
  const ci = currentIndex(stages);
  return (
    <header className={cx("vcp-phead", className)}>
      <div className="vcp-phead-crumbs">
        <Link href={backHref}>Projects</Link>
        <span aria-hidden>/</span>
        <span className="vcp-mono">{id}</span>
      </div>
      <div className="vcp-phead-row">
        <div className="vcp-phead-text">
          <h1 className="vcp-phead-title">{title}</h1>
          {oneLiner ? <p className="vcp-phead-line">{oneLiner}</p> : null}
        </div>
        {live || actions ? (
          <div className="vcp-phead-side">
            {live}
            {actions}
          </div>
        ) : null}
      </div>
      <div className="vcp-phead-status">
        <StatusBadge kind="project" status={status} />
        {tags}
        <span className="vcp-phead-stage">
          Stage <b>{stages[ci]!.label}</b>{" "}
          <span className="vcp-mono">
            {ci + 1}/{stages.length}
          </span>
        </span>
        <StageStrip stages={stages} showLabel={false} className="vcp-phead-strip" />
      </div>
    </header>
  );
}
