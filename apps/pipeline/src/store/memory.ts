import {
  newId,
  nowIso,
  type Asset,
  type Brief,
  type Idea,
  type Narration,
  type NewIdea,
  type PipelineConfig,
  type Project,
  type Render,
  type Script,
  type Stage,
  type Storyboard,
  type Upload,
} from "@vcp/core";
import type { Store } from "./types";

/** In-memory store for tests and dry runs. Same semantics as the Postgres one. */
export class MemoryStore implements Store {
  ideas = new Map<string, Idea>();
  projects = new Map<string, Project>();
  stages = new Map<string, Stage>();
  briefs: Brief[] = [];
  scripts: Script[] = [];
  narrations: Narration[] = [];
  storyboards: Storyboard[] = [];
  assets = new Map<string, Asset>();
  renders: Render[] = [];
  uploads: Upload[] = [];
  events: { projectId: string | null; type: string; payload: Record<string, unknown> }[] = [];

  constructor(private readonly config: PipelineConfig) {}

  // -- helpers for tests -----------------------------------------------------

  addIdea(input: NewIdea): Idea {
    const idea: Idea = { ...input, id: newId(), status: input.status ?? "new", createdAt: nowIso() };
    this.ideas.set(idea.id, idea);
    return idea;
  }

  addProject(ideaId: string, dryRun = false): Project {
    const now = nowIso();
    const p: Project = { id: newId(), ideaId, status: "active", dryRun, createdAt: now, updatedAt: now };
    this.projects.set(p.id, p);
    return p;
  }

  // -- Store -----------------------------------------------------------------

  async getIdea(id: string) {
    return this.ideas.get(id);
  }
  async setIdeaStatus(id: string, status: Idea["status"]) {
    const i = this.ideas.get(id);
    if (i) this.ideas.set(id, { ...i, status });
  }

  async getProject(id: string) {
    return this.projects.get(id);
  }
  async updateProject(id: string, patch: Partial<Project>) {
    const p = this.projects.get(id);
    if (p) this.projects.set(id, { ...p, ...patch, updatedAt: nowIso() });
  }
  async loadPipelineConfig() {
    return this.config;
  }

  async getStage(projectId: string, name: string) {
    return this.stages.get(`${projectId}:${name}`);
  }
  async upsertStage(projectId: string, name: string, patch: Parameters<Store["upsertStage"]>[2]) {
    const key = `${projectId}:${name}`;
    const prev = this.stages.get(key) ?? { id: newId(), projectId, name, status: "pending" as const, attempt: 0 };
    const next: Stage = {
      ...prev,
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.inputHash !== undefined && { inputHash: patch.inputHash }),
      ...(patch.providerId !== undefined && { providerId: patch.providerId }),
      ...(patch.startedAt !== undefined && { startedAt: patch.startedAt.toISOString() }),
      ...(patch.finishedAt !== undefined && { finishedAt: patch.finishedAt?.toISOString() }),
      ...(patch.attempt !== undefined && { attempt: patch.attempt }),
      ...(patch.error !== undefined && { error: patch.error ?? undefined }),
      ...(patch.artifactId !== undefined && { artifactId: patch.artifactId }),
      ...(patch.runId !== undefined && { runId: patch.runId }),
    };
    this.stages.set(key, next);
    return next;
  }

  async insertBrief(b: Brief) {
    this.briefs.push(b);
    return b;
  }
  async latestBrief(projectId: string) {
    return [...this.briefs].reverse().find((b) => b.projectId === projectId);
  }

  async insertScript(s: Script) {
    this.scripts.push(s);
    return s;
  }
  async getScript(id: string) {
    return this.scripts.find((s) => s.id === id);
  }
  async latestScript(projectId: string) {
    return this.scripts.filter((s) => s.projectId === projectId).sort((a, b) => b.version - a.version)[0];
  }
  async nextScriptVersion(projectId: string) {
    return ((await this.latestScript(projectId))?.version ?? 0) + 1;
  }
  async markScriptReviewed(id: string, by: "user" | "auto") {
    const s = this.scripts.find((x) => x.id === id);
    if (s) s.reviewedBy = by;
  }

  async insertNarration(n: Narration) {
    this.narrations.push(n);
    return n;
  }
  async latestNarration(projectId: string) {
    return [...this.narrations].reverse().find((n) => n.projectId === projectId);
  }

  async insertStoryboard(s: Storyboard) {
    this.storyboards.push(s);
    return s;
  }
  async updateStoryboard(id: string, patch: Partial<Pick<Storyboard, "scenes" | "containsSyntheticMedia">>) {
    const i = this.storyboards.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`storyboard ${id} not found`);
    const next = { ...this.storyboards[i]!, ...patch };
    this.storyboards[i] = next;
    return next;
  }
  async latestStoryboard(projectId: string) {
    return this.storyboards.filter((s) => s.projectId === projectId).sort((a, b) => b.version - a.version)[0];
  }
  async nextStoryboardVersion(projectId: string) {
    return ((await this.latestStoryboard(projectId))?.version ?? 0) + 1;
  }

  async insertAsset(a: Asset) {
    if (!this.assets.has(a.id)) this.assets.set(a.id, a);
    return this.assets.get(a.id)!;
  }
  async getAssets(ids: string[]) {
    return ids.map((id) => this.assets.get(id)).filter((a): a is Asset => Boolean(a));
  }

  async insertRender(r: Render) {
    this.renders.push(r);
    return r;
  }
  async latestRender(projectId: string) {
    return [...this.renders].reverse().find((r) => r.projectId === projectId);
  }

  async insertUpload(u: Upload) {
    this.uploads.push(u);
    return u;
  }
  async updateUpload(u: Upload) {
    const i = this.uploads.findIndex((x) => x.id === u.id);
    if (i < 0) throw new Error(`upload ${u.id} not found`);
    this.uploads[i] = u;
    return u;
  }
  async getUpload(id: string) {
    return this.uploads.find((u) => u.id === id);
  }
  async latestUpload(projectId: string) {
    return [...this.uploads].reverse().find((u) => u.projectId === projectId);
  }

  async logEvent(projectId: string | null, type: string, payload: Record<string, unknown> = {}) {
    this.events.push({ projectId, type, payload });
  }
}
