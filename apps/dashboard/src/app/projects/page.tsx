import type { Project } from "@vcp/core";
import { getIdea, listProjects, listStages } from "@vcp/db";
import { absoluteTime, relativeTime } from "@/components/ui/format";
import { ProjectList, type ProjectListItem } from "@/components/ui/ProjectList";
import { toStageRuns } from "@/components/ui/stages";

export const dynamic = "force-dynamic";

const RANK: Partial<Record<Project["status"], number>> = { waiting: 0, active: 1 };

function byAttention(a: Project, b: Project): number {
  const r = (RANK[a.status] ?? 2) - (RANK[b.status] ?? 2);
  return r || b.createdAt.localeCompare(a.createdAt);
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ idea?: string }> }) {
  const sp = await searchParams;
  let projects = await listProjects();
  if (sp.idea) projects = projects.filter((p) => p.ideaId === sp.idea);
  projects.sort(byAttention);

  const now = Date.now();
  const items: ProjectListItem[] = await Promise.all(
    projects.map(async (p) => {
      const [idea, stages] = await Promise.all([getIdea(p.ideaId), listStages(p.id)]);
      return {
        id: p.id,
        title: idea?.title ?? p.ideaId,
        oneLiner: idea?.oneLiner,
        status: p.status,
        stages: toStageRuns(stages),
        created: relativeTime(p.createdAt, now),
        createdAt: absoluteTime(p.createdAt),
        dryRun: p.dryRun,
        href: `/projects/${p.id}`,
      };
    }),
  );

  const waiting = projects.filter((p) => p.status === "waiting").length;
  const running = projects.filter((p) => p.status === "active").length;
  const summary = [waiting ? `${waiting} waiting on you` : null, running ? `${running} running` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="vcp-page-head">
        <div>
          <h1 className="vcp-page-title">Projects</h1>
          {summary ? <p className="vcp-page-sub">{summary}</p> : null}
        </div>
      </div>
      <ProjectList projects={items} ideasHref="/ideas" />
    </>
  );
}
