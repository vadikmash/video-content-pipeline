import { isGate, type Asset, type Brief, type Narration, type Render, type Scene, type Script, type StageName, type Storyboard, type Upload } from "@vcp/core";
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
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Poller } from "@/components/Poller";
import { ScriptEditor } from "@/components/ScriptEditor";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { EmptyState } from "@/components/ui/EmptyState";
import { absoluteTime, hostOf, mediaTime } from "@/components/ui/format";
import { GateBanner, type GateName } from "@/components/ui/GateBanner";
import { Icon } from "@/components/ui/Icon";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { MetaList } from "@/components/ui/MetaList";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { ProjectHeader } from "@/components/ui/ProjectHeader";
import { RejectControl } from "@/components/ui/RejectControl";
import { ScriptBody, scriptMeta } from "@/components/ui/ScriptView";
import { StageRail } from "@/components/ui/StageRail";
import { currentIndex, toStageRuns } from "@/components/ui/stages";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StoryboardTable, type StoryboardRow } from "@/components/ui/StoryboardTable";
import { Tag } from "@/components/ui/Tag";
import type { MetaItem, StageRun } from "@/components/ui/types";
import { VerticalPreview } from "@/components/ui/VerticalPreview";
import { blobUrl } from "@/lib/blob";
import { approveScript, approveVideo, publishUpload, rejectProject } from "./actions";

export const dynamic = "force-dynamic";

type ArtifactKey = "brief" | "script" | "narration" | "storyboard" | "render" | "upload";

const PIPELINE_ORDER: ArtifactKey[] = ["brief", "script", "narration", "storyboard", "render", "upload"];

/** The stage whose output each panel shows; its status is the panel's status. */
const PRODUCER: Record<ArtifactKey, StageName> = {
  brief: "research",
  script: "write",
  narration: "voice",
  storyboard: "storyboard",
  render: "render",
  upload: "upload",
};

const EMPTY_HINT: Record<ArtifactKey, string> = {
  brief: "Research writes it from the idea's evidence.",
  script: "Write drafts it from the brief.",
  narration: "Voice records it after the script is approved.",
  storyboard: "Storyboard and Assets build it from the narration.",
  render: "Render assembles it from the storyboard.",
  upload: "Uploads as private after you approve the video.",
};

const GATE_LAYOUT: Record<GateName, { order: ArtifactKey[]; open: ArtifactKey[] }> = {
  "approve-script": { order: ["script", "brief", "narration", "storyboard", "render", "upload"], open: ["script"] },
  "approve-video": { order: ["render", "storyboard", "narration", "script", "brief", "upload"], open: ["render", "storyboard"] },
  "approve-publish": { order: ["upload", "render", "storyboard", "narration", "script", "brief"], open: ["upload"] },
};

interface Artifacts {
  brief?: Brief;
  script?: Script;
  narration?: Narration;
  storyboard?: Storyboard;
  render?: Render;
  upload?: Upload;
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
  const artifacts: Artifacts = { brief, script, narration, storyboard, render, upload };
  const assetIds = storyboard?.scenes.map((s) => s.assetId).filter((x): x is string => Boolean(x)) ?? [];
  const assets = new Map((await getAssets(assetIds)).map((a) => [a.id, a]));
  const inngestUrl = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";
  const runs = toStageRuns(stageRows, inngestUrl);
  const live = project.status === "active" || project.status === "waiting";
  const stage = project.status === "waiting" ? project.currentStage : undefined;
  const gate = stage && isGate(stage) ? (stage as GateName) : undefined;
  const reject = rejectProject.bind(null, project.id);

  const ci = currentIndex(runs);
  const doneCount = runs.filter((r) => r.status === "done").length;
  const failedRun = project.status === "failed" ? runs.find((r) => r.status === "failed") : undefined;

  const layout = gate ? GATE_LAYOUT[gate] : undefined;
  const order = layout?.order ?? PIPELINE_ORDER;
  const open = layout?.open ?? latestAvailable(artifacts);
  const statusOf = (k: ArtifactKey) => runs.find((r) => r.key === PRODUCER[k])!.status;
  const assetsFailed = runs.find((r) => r.key === "assets")!.status === "failed";

  const panels: Record<ArtifactKey, () => ReactNode> = {
    brief: () => (
      <Panel
        key="brief"
        title="Brief & sources"
        meta={brief ? plural(brief.sources.length, "source") : undefined}
        status={statusOf("brief")}
        collapsible
        defaultOpen={open.includes("brief")}
      >
        {brief ? <BriefBody brief={brief} /> : <Empty k="brief" runs={runs} live={live} />}
      </Panel>
    ),
    script: () => (
      <Panel
        key="script"
        title="Script"
        meta={
          script ? (
            <>
              v{script.version}
              {script.reviewedBy ? ` · reviewed by ${script.reviewedBy}` : ""}
              {script.provider === "user-edit" ? (
                <>
                  {" "}
                  <Tag icon="edit">hand-edited</Tag>
                </>
              ) : null}
            </>
          ) : undefined
        }
        status={statusOf("script")}
        collapsible
        defaultOpen={open.includes("script")}
      >
        {script ? (
          <ScriptEditor
            projectId={project.id}
            script={script}
            meta={scriptMeta(script)}
            editable={gate === "approve-script"}
          >
            <ScriptBody script={script} />
          </ScriptEditor>
        ) : (
          <Empty k="script" runs={runs} live={live} />
        )}
      </Panel>
    ),
    narration: () => (
      <Panel
        key="narration"
        title="Narration"
        meta={narration ? mediaTime(narration.durationSec) : undefined}
        status={statusOf("narration")}
        collapsible
        defaultOpen={open.includes("narration")}
      >
        {narration ? (
          <AudioPlayer
            src={blobUrl(narration.audioBlob.key)}
            duration={narration.durationSec}
            title={script ? `Narration · v${script.version}` : "Narration"}
            seed={narration.words.length}
            meta={
              <span className="vcp-mono">
                {narration.durationSec.toFixed(1)}s · {narration.words.length} words · {narration.provider}
                {narration.alignerProvider ? ` + ${narration.alignerProvider}` : ""}
              </span>
            }
          />
        ) : (
          <Empty k="narration" runs={runs} live={live} />
        )}
      </Panel>
    ),
    storyboard: () => (
      <Panel
        key="storyboard"
        title="Storyboard"
        meta={
          storyboard
            ? storyboardMeta(storyboard, assets)
            : undefined
        }
        status={statusOf("storyboard")}
        actions={storyboard?.containsSyntheticMedia ? <Tag tone="waiting">synthetic media</Tag> : undefined}
        collapsible
        defaultOpen={open.includes("storyboard")}
      >
        {storyboard ? (
          <StoryboardTable rows={storyboardRows(storyboard, assets, script, assetsFailed)} />
        ) : (
          <Empty k="storyboard" runs={runs} live={live} />
        )}
      </Panel>
    ),
    render: () => (
      <Panel
        key="render"
        title="Render"
        meta={render ? `${render.templateId}@${render.templateVersion} · ${mediaTime(render.durationSec)}` : undefined}
        status={statusOf("render")}
        collapsible
        defaultOpen={open.includes("render")}
      >
        {render ? (
          <VerticalPreview
            src={blobUrl(render.blob.key)}
            poster={render.thumbnailBlob ? blobUrl(render.thumbnailBlob.key) : undefined}
            meta={renderMeta(render)}
            downloadHref={blobUrl(render.blob.key)}
            thumbnailHref={render.thumbnailBlob ? blobUrl(render.thumbnailBlob.key) : undefined}
          />
        ) : (
          <Empty k="render" runs={runs} live={live} />
        )}
      </Panel>
    ),
    upload: () => (
      <Panel
        key="upload"
        title="Upload"
        meta={upload ? `${upload.provider} · ${upload.status}` : undefined}
        status={statusOf("upload")}
        collapsible
        defaultOpen={open.includes("upload")}
      >
        {upload ? <MetaList items={uploadMeta(upload)} className="vcp-upload-meta" /> : <Empty k="upload" runs={runs} live={live} />}
      </Panel>
    ),
  };

  const rail = <StageRail stages={runs} />;

  return (
    <>
      <Poller enabled={live} />
      <ProjectHeader
        id={project.id}
        title={idea?.title ?? project.ideaId}
        oneLiner={idea?.oneLiner}
        status={project.status}
        stages={runs}
        tags={project.dryRun ? <Tag>dry run</Tag> : undefined}
        live={live ? <LiveIndicator updatedAt={Date.now()} /> : undefined}
        actions={project.status === "active" ? <RejectControl action={reject} /> : undefined}
      />

      {project.rejectReason ? (
        <Notice tone="failed" title="Rejected" className="vcp-detail-notice">
          {project.rejectReason}
        </Notice>
      ) : failedRun ? (
        <Notice tone="failed" title={`Failed at ${failedRun.label}`} className="vcp-detail-notice">
          {failedRun.error ?? "See the run logs in the stage rail."}
        </Notice>
      ) : null}

      <div className="vcp-detail">
        <aside className="vcp-detail-rail vcp-detail-rail--wide">
          <div className="vcp-detail-rail-head">
            <span className="vcp-kicker">Pipeline</span>
            <span className="vcp-mono vcp-faint">
              {doneCount}/{runs.length} done
            </span>
          </div>
          {rail}
        </aside>
        <div className="vcp-stack">
          {gate ? (
            <GateBanner
              gate={gate}
              approveAction={
                gate === "approve-script"
                  ? approveScript.bind(null, project.id)
                  : gate === "approve-video"
                    ? approveVideo.bind(null, project.id)
                    : publishUpload.bind(null, project.id)
              }
              rejectAction={reject}
              disabled={gate === "approve-script" ? !script : gate === "approve-video" ? !render : !upload}
            />
          ) : null}
          <Panel
            title="Stages"
            meta={`${ci + 1}/${runs.length} · ${runs[ci]!.label}`}
            collapsible
            className="vcp-detail-rail--narrow"
          >
            {rail}
          </Panel>
          {order.map((k) => panels[k]())}
        </div>
      </div>
    </>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The furthest artifact that exists, opened by default when no gate is waiting. */
function latestAvailable(a: Artifacts): ArtifactKey[] {
  const last = [...PIPELINE_ORDER].reverse().find((k) => a[k]);
  return last ? [last] : [];
}

function Empty({ k, runs, live }: { k: ArtifactKey; runs: StageRun[]; live: boolean }) {
  const run = runs.find((r) => r.key === PRODUCER[k])!;
  if (run.status === "failed") {
    return (
      <EmptyState compact icon="alert" title={`${run.label} failed`}>
        {run.error ?? "See the run logs in the stage rail."}
      </EmptyState>
    );
  }
  if (!live) {
    return (
      <EmptyState compact icon="x" title="Not produced">
        The run stopped before {run.label}.
      </EmptyState>
    );
  }
  return (
    <EmptyState compact icon={run.status === "running" ? "running" : "pending"} title={`Waiting on ${run.label}`}>
      {EMPTY_HINT[k]}
    </EmptyState>
  );
}

function BriefBody({ brief }: { brief: Brief }) {
  return (
    <div className="vcp-brief">
      <div>
        <span className="vcp-kicker">Summary</span>
        <p>{brief.summary}</p>
      </div>
      <div>
        <span className="vcp-kicker">Angle</span>
        <p className="vcp-muted">{brief.angle}</p>
      </div>
      {brief.evidence.length > 0 ? (
        <div>
          <span className="vcp-kicker">Evidence</span>
          <ul className="vcp-evidence">
            {brief.evidence.map((e, k) => (
              <li key={k}>
                <q>{e.quote}</q>
                <a href={e.url} target="_blank" rel="noreferrer" title={e.title ?? e.url}>
                  {hostOf(e.url)}
                  <Icon name="external" size={12} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <span className="vcp-kicker">Sources</span>
        <ul className="vcp-evidence vcp-brief-sources">
          {brief.sources.map((s) => (
            <li key={s}>
              <a href={s} target="_blank" rel="noreferrer">
                {s.replace(/^https?:\/\/(www\.)?/, "")}
                <Icon name="external" size={12} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Type and diagram scenes are drawn by the template and never get an asset. */
function needsAsset(scene: Scene): boolean {
  return scene.visual.kind === "stock" || scene.visual.kind === "still" || scene.visual.kind === "clip";
}

function visualText(scene: Scene, script?: Script): string {
  const v = scene.visual;
  if (v.kind === "stock") return v.query;
  if (v.kind === "still" || v.kind === "clip") return v.prompt;
  if (v.kind === "type") {
    const text =
      scene.beatId === "hook"
        ? script?.hook
        : scene.beatId === "outro"
          ? script?.outro
          : script?.beats.find((b) => b.id === scene.beatId)?.text;
    return text ?? "On-screen text";
  }
  return "Diagram";
}

function storyboardMeta(storyboard: Storyboard, assets: Map<string, Asset>): string {
  const needed = storyboard.scenes.filter(needsAsset);
  const ready = needed.filter((s) => s.assetId && assets.has(s.assetId)).length;
  return [`v${storyboard.version}`, plural(storyboard.scenes.length, "beat"), `${ready}/${needed.length} assets`].join(" · ");
}

function storyboardRows(
  storyboard: Storyboard,
  assets: Map<string, Asset>,
  script: Script | undefined,
  assetsFailed: boolean,
): StoryboardRow[] {
  return storyboard.scenes.map((sc, k) => {
    const a = sc.assetId ? assets.get(sc.assetId) : undefined;
    const credit = a ? `${a.attribution.text || a.provider}${a.synthetic ? " · synthetic" : ""}` : undefined;
    return {
      beat: k + 1,
      time: `${mediaTime(sc.start)}–${mediaTime(sc.end)}`,
      kind: sc.visual.kind,
      visual: visualText(sc, script),
      thumb: a?.kind === "image" ? blobUrl(a.blob.key) : undefined,
      assetStatus: a || !needsAsset(sc) ? "ready" : assetsFailed ? "failed" : "missing",
      assetName: a ? `${a.provider} · ${a.kind} · ${a.licence}` : undefined,
      attribution:
        a && credit ? (
          a.attribution.url ? (
            <a href={a.attribution.url} target="_blank" rel="noreferrer">
              {credit}
            </a>
          ) : (
            credit
          )
        ) : undefined,
    };
  });
}

function renderMeta(render: Render): MetaItem[] {
  return [
    { label: "Resolution", value: `${render.width} × ${render.height} @ ${render.fps}`, mono: true },
    { label: "Duration", value: `${render.durationSec.toFixed(1)}s`, mono: true },
    { label: "Provider", value: render.provider, mono: true },
    { label: "Template", value: `${render.templateId}@${render.templateVersion}`, mono: true },
  ];
}

function uploadMeta(upload: Upload): MetaItem[] {
  const items: MetaItem[] = [
    {
      label: "Privacy",
      value: <StatusBadge kind="privacy" status={upload.privacy} size="sm" />,
    },
    { label: "Status", value: upload.status, mono: true },
    { label: "Remote ID", value: upload.remoteId, mono: true, copy: true },
    { label: "Provider", value: upload.provider, mono: true },
  ];
  if (upload.publishAt) items.push({ label: "Publish at", value: absoluteTime(upload.publishAt), mono: true });
  if (upload.remoteUrl) {
    items.push({
      label: "Link",
      value: (
        <a href={upload.remoteUrl} target="_blank" rel="noreferrer">
          {hostOf(upload.remoteUrl)}
        </a>
      ),
    });
  }
  items.push(
    { label: "Title", value: upload.meta.title },
    { label: "Description", value: <span className="vcp-upload-desc">{upload.meta.description}</span> },
    {
      label: "Tags",
      value: upload.meta.tags.length ? (
        <span className="vcp-upload-tags">
          {upload.meta.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </span>
      ) : (
        "—"
      ),
    },
    {
      label: "Disclosure",
      value: upload.containsSyntheticMedia ? <Tag tone="waiting">synthetic media disclosed</Tag> : "none",
    },
  );
  return items;
}
