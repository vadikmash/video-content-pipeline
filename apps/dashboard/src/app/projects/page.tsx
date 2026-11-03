import type { Project } from "@vcp/core";
import { getIdea, listProjects } from "@vcp/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<Project["status"], string> = {
  active: "info",
  waiting: "accent",
  rejected: "bad",
  failed: "bad",
  published: "ok",
};

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ idea?: string }> }) {
  const sp = await searchParams;
  let projects = await listProjects();
  if (sp.idea) projects = projects.filter((p) => p.ideaId === sp.idea);
  const ideas = new Map(
    await Promise.all(projects.map(async (p) => [p.id, await getIdea(p.ideaId)] as const)),
  );

  return (
    <>
      <h1>Projects</h1>
      <section className="panel">
        {projects.length === 0 ? (
          <p className="muted">
            No projects yet. <Link href="/ideas">Select an idea</Link> to start one.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/projects/${p.id}`} style={{ fontWeight: 700 }}>
                      {ideas.get(p.id)?.title ?? p.ideaId}
                    </Link>
                    {p.dryRun ? <span className="badge" style={{ marginLeft: 8 }}>dry run</span> : null}
                    <div className="muted small">{p.id}</div>
                  </td>
                  <td>{p.currentStage ?? "-"}</td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[p.status]}`}>{p.status}</span>
                    {p.rejectReason ? <div className="small muted">{p.rejectReason}</div> : null}
                  </td>
                  <td className="small muted">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
