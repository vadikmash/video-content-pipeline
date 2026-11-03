import type {
  Asset,
  Brief,
  Idea,
  IdeaStatus,
  Narration,
  PipelineConfig,
  Project,
  ProjectStatus,
  Render,
  Script,
  Stage,
  StageStatus,
  Storyboard,
  Upload,
} from "@vcp/core";

export interface StagePatch {
  status?: StageStatus;
  inputHash?: string;
  providerId?: string;
  startedAt?: Date;
  finishedAt?: Date | null;
  attempt?: number;
  error?: string | null;
  artifactId?: string;
  runId?: string;
}

export interface ProjectPatch {
  status?: ProjectStatus;
  currentStage?: string;
  rejectReason?: string;
  runId?: string;
}

/**
 * Everything a stage handler needs from persistence. `@vcp/db` implements it
 * on Postgres; tests use the in-memory version so the golden e2e needs no database.
 */
export interface Store {
  getIdea(id: string): Promise<Idea | undefined>;
  setIdeaStatus(id: string, status: IdeaStatus): Promise<void>;

  getProject(id: string): Promise<Project | undefined>;
  updateProject(id: string, patch: ProjectPatch): Promise<void>;
  loadPipelineConfig(projectId: string): Promise<PipelineConfig>;

  getStage(projectId: string, name: string): Promise<Stage | undefined>;
  upsertStage(projectId: string, name: string, patch: StagePatch): Promise<Stage>;

  insertBrief(b: Brief): Promise<Brief>;
  latestBrief(projectId: string): Promise<Brief | undefined>;

  insertScript(s: Script): Promise<Script>;
  getScript(id: string): Promise<Script | undefined>;
  latestScript(projectId: string): Promise<Script | undefined>;
  nextScriptVersion(projectId: string): Promise<number>;
  markScriptReviewed(id: string, by: "user" | "auto"): Promise<void>;

  insertNarration(n: Narration): Promise<Narration>;
  latestNarration(projectId: string): Promise<Narration | undefined>;

  insertStoryboard(s: Storyboard): Promise<Storyboard>;
  updateStoryboard(id: string, patch: Partial<Pick<Storyboard, "scenes" | "containsSyntheticMedia">>): Promise<Storyboard>;
  latestStoryboard(projectId: string): Promise<Storyboard | undefined>;
  nextStoryboardVersion(projectId: string): Promise<number>;

  insertAsset(a: Asset, projectId: string): Promise<Asset>;
  getAssets(ids: string[]): Promise<Asset[]>;

  insertRender(r: Render): Promise<Render>;
  latestRender(projectId: string): Promise<Render | undefined>;

  insertUpload(u: Upload): Promise<Upload>;
  updateUpload(u: Upload): Promise<Upload>;
  getUpload(id: string): Promise<Upload | undefined>;
  latestUpload(projectId: string): Promise<Upload | undefined>;

  logEvent(projectId: string | null, type: string, payload?: Record<string, unknown>): Promise<void>;
}
