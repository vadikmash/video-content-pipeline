import type { ProjectStatus } from "@vcp/core";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { cx } from "./format";
import { StageStrip } from "./StageStrip";
import { StatusBadge } from "./StatusBadge";
import { Tag } from "./Tag";
import type { StageRun } from "./types";

export interface ProjectListItem {
  id: string;
  title: string;
  oneLiner?: string;
  status: ProjectStatus;
  stages: StageRun[];
  /** Relative, e.g. "12m ago". */
  created: string;
  /** Absolute, shown on hover. */
  createdAt: string;
  dryRun?: boolean;
  href: string;
}

export function ProjectRow({ project, className }: { project: ProjectListItem; className?: string }) {
  return (
    <Link className={cx("vcp-prow", className)} href={project.href} role="listitem">
      <div className="vcp-prow-grid">
        <div className="vcp-prow-title">
          <span className="vcp-prow-name">
            {project.title}
            {project.dryRun ? (
              <>
                {" "}
                <Tag>dry run</Tag>
              </>
            ) : null}
          </span>
          {project.oneLiner ? <span className="vcp-prow-line">{project.oneLiner}</span> : null}
        </div>
        <StageStrip stages={project.stages} className="vcp-prow-strip" />
        <div className="vcp-prow-status">
          <StatusBadge kind="project" status={project.status} size="sm" />
        </div>
        <time className="vcp-prow-time" title={project.createdAt}>
          {project.created}
        </time>
      </div>
    </Link>
  );
}

export function ProjectList({
  projects,
  ideasHref = "/ideas",
  empty,
}: {
  projects: ProjectListItem[];
  ideasHref?: string;
  empty?: ReactNode;
}) {
  if (!projects.length) {
    return (
      <div className="vcp-plist">
        {empty ?? (
          <EmptyState
            icon="arrow"
            title="No projects yet"
            action={
              <Button variant="primary" href={ideasHref}>
                Pick an idea
              </Button>
            }
          >
            A project starts when you select an idea in the inbox.
          </EmptyState>
        )}
      </div>
    );
  }
  return (
    <div className="vcp-plist" role="list">
      <div className="vcp-prow-head" aria-hidden>
        <span>Project</span>
        <span>Stage</span>
        <span>Status</span>
        <span className="vcp-prow-time">Created</span>
      </div>
      {projects.map((p) => (
        <ProjectRow key={p.id} project={p} />
      ))}
    </div>
  );
}
