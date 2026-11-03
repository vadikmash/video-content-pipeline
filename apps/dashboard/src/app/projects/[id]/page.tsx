import { STAGES, isGate, type Project, type Stage } from "@vcp/core";
import {
  getAssets,
  getIdea,
  getProject,
  latestBrief,
  latestNarration,
  latestRender,
  latestScript,
  latestStoryboard,
  latestUpload,
  listStages,
} from "@vcp/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Poller } from "@/components/Poller";
import { ScriptEditor } from "@/components/ScriptEditor";
import { blobUrl } from "@/lib/blob";
import { approveScript, approveVideo, publishUpload, rejectProject } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<Project["status"], string> = {
  active: "info",
  waiting: "accent",
  rejected: "bad",
  failed: "bad",
  published: "ok",
};

function fmtDuration(s?: Stage): string {
  if (!s?.startedAt) return "";
  const end = s.finishedAt ? new Date(s.finishedAt).getTime() : Date.now();
  const ms = end - new Date(s.startedAt).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [idea, stageRows, brief, script, narration, storyboard, render, upload] = await Promise.all([
    getIdea(project.ideaId),
    listStages(id),
    latestBrief(id),
    latestScript(id),
    latestNarration(id),
    latestStoryboard(id),
    latestRender(id),
    latestUpload(id),
  ]);
  const stages = new Map(stageRows.map((s) => [s.name, s]));
  const assetIds = storyboard?.scenes.map((s) => s.assetId).filter((x): x is string => Boolean(x)) ?? [];
  const assets = new Map((await getAssets(assetIds)).map((a) => [a.id, a]));
  const inngestUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  const live = project.status === "active" || project.status === "waiting";
  const gate = project.status === "waiting" ? project.currentStage : undefined;
  const canEditScript = gate === "approve-script" && !!script;

  return (
    <>
      <Poller enabled={live} />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{idea?.title ?? project.ideaId}</h1>
          <div className="muted small">
            {idea?.oneLiner} · project {project.id}
            {project.dryRun ? " · dry run" : ""}
          </div>
        </div>
        <div className="row">
          <span className={`badge ${STATUS_CLASS[project.status]}`}>{project.status}</span>
          <span className="muted small">{project.currentStage ?? "queued"}</span>
        </div>
      </div>

      {project.rejectReason ? (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          Rejected: {project.rejectReason}
        </div>
      ) : null}

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Stages</h2>
        <div className="rail">
          {STAGES.map((name) => {
            const s = stages.get(name);
            const status = s?.status ?? "pending";
            return (
              <div key={name} className={`stage ${status}`}>
                <div className="name">
                  {isGate(name) ? "⏸ " : ""}
                  {name}
                </div>
                <div className="small muted">{status}</div>
                {s?.providerId ? <div className="small">{s.providerId}</div> : null}
                <div className="small muted">
                  {fmtDuration(s)}
                  {s && s.attempt > 1 ? ` · attempt ${s.attempt}` : ""}
                </div>
                {s?.runId ? (
                  <a className="small" href={`${inngestUrl}/run?runID=${s.runId}`} target="_blank" rel="noreferrer">
                    run
                  </a>
                ) : null}
                {s?.error ? (
                  <div className="small" style={{ color: "var(--bad)" }}>
                    {s.error}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {gate ? (
        <section className="panel" style={{ borderColor: "var(--accent)" }}>
          <h2 style={{ marginTop: 0 }}>Waiting on you: {gate}</h2>
          <GateActions projectId={project.id} gate={gate} hasScript={!!script} hasRender={!!render} hasUpload={!!upload} />
        </section>
      ) : null}

      {live ? (
        <section className="panel">
          <form action={rejectProject.bind(null, project.id)} className="row">
            <input name="reason" placeholder="Reject with a reason (stops the run; nothing is deleted)" style={{ flex: 1 }} />
            <button type="submit" className="danger">
              Reject
            </button>
          </form>
        </section>
      ) : null}

      <div className="grid2">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Brief</h2>
          {brief ? (
            <>
              <p>{brief.summary}</p>
              <p className="muted">{brief.angle}</p>
              <div className="small">
                Sources:
                <ul>
                  {brief.sources.map((s) => (
                    <li key={s}>
                      <a href={s} target="_blank" rel="noreferrer">
                        {s}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="muted">Not yet.</p>
          )}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>
            Script {script ? `v${script.version}` : ""}{" "}
            {script?.reviewedBy ? <span className="badge ok">reviewed by {script.reviewedBy}</span> : null}
          </h2>
          {script ? (
            <>
              {script.provider === "user-edit" ? <span className="badge accent">hand-edited</span> : null}
              <ScriptEditor projectId={project.id} script={script} editable={canEditScript} />
              <details>
                <summary className="small">claims</summary>
                <ul className="small">
                  {script.claims.map((c, i) => (
                    <li key={i}>
                      {c.text} —{" "}
                      <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                        source
                      </a>{" "}
                      ({Math.round(c.confidence * 100)}%)
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="muted">Not yet.</p>
          )}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Narration</h2>
          {narration ? (
            <>
              <audio controls src={blobUrl(narration.audioBlob.key)} style={{ width: "100%" }} />
              <div className="small muted">
                {narration.durationSec.toFixed(1)}s · {narration.words.length} words · {narration.provider}
                {narration.alignerProvider ? ` + ${narration.alignerProvider}` : ""}
              </div>
            </>
          ) : (
            <p className="muted">Not yet.</p>
          )}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>
            Storyboard {storyboard ? `v${storyboard.version}` : ""}{" "}
            {storyboard?.containsSyntheticMedia ? <span className="badge warn">synthetic media</span> : null}
          </h2>
          {storyboard ? (
            <table>
              <thead>
                <tr>
                  <th>Beat</th>
                  <th>Time</th>
                  <th>Visual</th>
                  <th>Asset</th>
                </tr>
              </thead>
              <tbody>
                {storyboard.scenes.map((sc) => {
                  const a = sc.assetId ? assets.get(sc.assetId) : undefined;
                  return (
                    <tr key={sc.beatId}>
                      <td>{sc.beatId}</td>
                      <td className="small">
                        {sc.start.toFixed(1)}–{sc.end.toFixed(1)}s
                      </td>
                      <td className="small">
                        <span className="badge">{sc.visual.kind}</span>{" "}
                        {"query" in sc.visual ? sc.visual.query : "prompt" in sc.visual ? sc.visual.prompt : ""}
                      </td>
                      <td className="small">
                        {a ? (
                          <>
                            {a.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={blobUrl(a.blob.key)} alt="" style={{ width: 48, borderRadius: 4 }} />
                            ) : null}
                            <div>
                              {a.provider}
                              {a.synthetic ? " · synthetic" : ""}
                            </div>
                            <div className="muted">{a.attribution.text}</div>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">Not yet.</p>
          )}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Render</h2>
          {render ? (
            <>
              <video controls src={blobUrl(render.blob.key)} poster={render.thumbnailBlob ? blobUrl(render.thumbnailBlob.key) : undefined} />
              <div className="small muted">
                {render.durationSec.toFixed(1)}s · {render.width}×{render.height}@{render.fps} · {render.provider} ·{" "}
                {render.templateId}@{render.templateVersion}
              </div>
              <a className="small" href={blobUrl(render.blob.key)} download>
                download mp4
              </a>
            </>
          ) : (
            <p className="muted">Not yet.</p>
          )}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Upload</h2>
          {upload ? (
            <>
              <div className="row">
                <span className={`badge ${upload.privacy === "public" ? "ok" : "info"}`}>{upload.privacy}</span>
                <span className="badge">{upload.status}</span>
                {upload.containsSyntheticMedia ? <span className="badge warn">disclosure on</span> : null}
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                {upload.provider} · {upload.remoteId}
                {upload.remoteUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={upload.remoteUrl} target="_blank" rel="noreferrer">
                      remote
                    </a>
                  </>
                ) : null}
                {upload.publishAt ? ` · publish at ${new Date(upload.publishAt).toLocaleString()}` : ""}
              </div>
              <h2>Metadata</h2>
              <div>
                <strong>{upload.meta.title}</strong>
              </div>
              <pre>{upload.meta.description}</pre>
              <div className="small muted">tags: {upload.meta.tags.join(", ")}</div>
            </>
          ) : (
            <p className="muted">Not yet.</p>
          )}
        </section>
      </div>

      <p className="small muted">
        <Link href="/projects">← all projects</Link>
      </p>
    </>
  );
}

function GateActions({
  projectId,
  gate,
  hasScript,
  hasRender,
  hasUpload,
}: {
  projectId: string;
  gate: string;
  hasScript: boolean;
  hasRender: boolean;
  hasUpload: boolean;
}) {
  if (gate === "approve-script") {
    return (
      <form action={approveScript.bind(null, projectId)} className="row">
        <span className="muted">Edit the script first if needed, then approve.</span>
        <button type="submit" className="primary" disabled={!hasScript}>
          Approve script
        </button>
      </form>
    );
  }
  if (gate === "approve-video") {
    return (
      <form action={approveVideo.bind(null, projectId)} className="row">
        <span className="muted">Watch the render below. Approving uploads it as private.</span>
        <button type="submit" className="primary" disabled={!hasRender}>
          Approve video
        </button>
      </form>
    );
  }
  if (gate === "approve-publish") {
    return (
      <form action={publishUpload.bind(null, projectId)} className="row">
        <span className="muted">Publish now, or pick a time:</span>
        <input type="datetime-local" name="publishAt" style={{ width: 240 }} />
        <button type="submit" className="primary" disabled={!hasUpload}>
          Publish
        </button>
      </form>
    );
  }
  return <span className="muted">Unknown gate {gate}</span>;
}
