import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const Id = z.string().min(1);
export const IsoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

export const BlobRef = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
});
export type BlobRef = z.infer<typeof BlobRef>;

export const Domain = z.enum([
  "history",
  "science",
  "nature",
  "technology",
  "geography",
  "culture",
  "economics",
  "other",
]);
export type Domain = z.infer<typeof Domain>;

export const Evidence = z.object({
  url: z.string().url(),
  quote: z.string().min(1),
  title: z.string().optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Word = z.object({
  text: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});
export type Word = z.infer<typeof Word>;

// ---------------------------------------------------------------------------
// Idea
// ---------------------------------------------------------------------------

export const IdeaStatus = z.enum(["new", "shortlisted", "selected", "rejected", "done"]);
export type IdeaStatus = z.infer<typeof IdeaStatus>;

export const Idea = z.object({
  id: Id,
  origin: z.enum(["manual", "research"]),
  sourceProvider: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  title: z.string().min(1),
  oneLiner: z.string().min(1),
  whySurprising: z.string().min(1),
  domain: Domain,
  evidence: z.array(Evidence),
  /** Manual ideas marked as opinion skip the "second source" originality rule. */
  opinion: z.boolean().default(false),
  score: z.number().min(0).max(1).optional(),
  status: IdeaStatus,
  createdAt: IsoDate,
});
export type Idea = z.infer<typeof Idea>;

export const NewIdea = Idea.omit({ id: true, createdAt: true, status: true }).extend({
  status: IdeaStatus.default("new"),
});
export type NewIdea = z.infer<typeof NewIdea>;

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

export const Brief = z.object({
  id: Id,
  projectId: Id,
  ideaId: Id,
  summary: z.string().min(1),
  angle: z.string().min(1),
  evidence: z.array(Evidence),
  /** Distinct source URLs; must include one that is not the idea's own origin unless opinion. */
  sources: z.array(z.string().url()),
  provider: z.string(),
  createdAt: IsoDate,
});
export type Brief = z.infer<typeof Brief>;

/** What the TextModel is asked to produce for a brief (no ids, no timestamps). */
export const BriefDraft = Brief.pick({ summary: true, angle: true, evidence: true, sources: true });
export type BriefDraft = z.infer<typeof BriefDraft>;

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export const VisualIntent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("type") }),
  z.object({ kind: z.literal("stock"), query: z.string().min(1), orientation: z.literal("portrait") }),
  z.object({ kind: z.literal("still"), prompt: z.string().min(1), style: z.string().min(1) }),
  z.object({ kind: z.literal("clip"), prompt: z.string().min(1), seconds: z.number().positive() }),
  z.object({ kind: z.literal("diagram"), spec: z.record(z.string(), z.unknown()) }),
]);
export type VisualIntent = z.infer<typeof VisualIntent>;
export type VisualKind = VisualIntent["kind"];

export const Beat = z.object({
  id: Id,
  text: z.string().min(1),
  visual: VisualIntent,
});
export type Beat = z.infer<typeof Beat>;

export const Claim = z.object({
  text: z.string().min(1),
  sourceUrl: z.string().url(),
  confidence: z.number().min(0).max(1),
});
export type Claim = z.infer<typeof Claim>;

export const ScriptDraft = z.object({
  hook: z.string().min(1),
  beats: z.array(Beat).min(1),
  outro: z.string().min(1),
  estimatedSeconds: z.number().positive(),
  claims: z.array(Claim),
});
export type ScriptDraft = z.infer<typeof ScriptDraft>;

export const Script = ScriptDraft.extend({
  id: Id,
  projectId: Id,
  ideaId: Id,
  version: z.number().int().positive(),
  reviewedBy: z.enum(["user", "auto"]).optional(),
  provider: z.string(),
  createdAt: IsoDate,
});
export type Script = z.infer<typeof Script>;

/** Full narration text in reading order; what Speech receives. */
export function scriptText(script: Pick<Script, "hook" | "beats" | "outro">): string {
  return [script.hook, ...script.beats.map((b) => b.text), script.outro].join(" ");
}

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

export const Narration = z.object({
  id: Id,
  projectId: Id,
  scriptId: Id,
  audioBlob: BlobRef,
  words: z.array(Word),
  voiceId: z.string(),
  provider: z.string(),
  alignerProvider: z.string().optional(),
  durationSec: z.number().nonnegative(),
  createdAt: IsoDate,
});
export type Narration = z.infer<typeof Narration>;

// ---------------------------------------------------------------------------
// Storyboard
// ---------------------------------------------------------------------------

export const Scene = z.object({
  beatId: Id,
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  visual: VisualIntent,
  assetId: Id.optional(),
});
export type Scene = z.infer<typeof Scene>;

export const StoryboardDraft = z.object({
  scenes: z.array(Scene).min(1),
});
export type StoryboardDraft = z.infer<typeof StoryboardDraft>;

export const Storyboard = StoryboardDraft.extend({
  id: Id,
  projectId: Id,
  narrationId: Id,
  version: z.number().int().positive(),
  /** Set by the assets stage when any scene used clip or photoreal still of a real subject. */
  containsSyntheticMedia: z.boolean().default(false),
  provider: z.string(),
  createdAt: IsoDate,
});
export type Storyboard = z.infer<typeof Storyboard>;

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------

export const Attribution = z.object({
  text: z.string(),
  url: z.string().url().or(z.literal("")),
});
export type Attribution = z.infer<typeof Attribution>;

export const Asset = z.object({
  id: Id,
  kind: z.enum(["video", "image", "audio"]),
  blob: BlobRef,
  provider: z.string(),
  licence: z.string(),
  attribution: Attribution,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSec: z.number().positive().optional(),
  /** True for generated media that depicts something presented as real. */
  synthetic: z.boolean().default(false),
  createdAt: IsoDate,
});
export type Asset = z.infer<typeof Asset>;

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export const Render = z.object({
  id: Id,
  projectId: Id,
  storyboardId: Id,
  templateId: z.string(),
  templateVersion: z.string(),
  blob: BlobRef,
  thumbnailBlob: BlobRef.optional(),
  durationSec: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  provider: z.string(),
  createdAt: IsoDate,
});
export type Render = z.infer<typeof Render>;

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export const Privacy = z.enum(["private", "unlisted", "public"]);
export type Privacy = z.infer<typeof Privacy>;

export const UploadMeta = z.object({
  title: z.string().min(1).max(100),
  description: z.string(),
  tags: z.array(z.string()),
  containsSyntheticMedia: z.boolean(),
});
export type UploadMeta = z.infer<typeof UploadMeta>;

export const Upload = z.object({
  id: Id,
  projectId: Id,
  renderId: Id,
  provider: z.string(),
  remoteId: z.string(),
  remoteUrl: z.string().url().optional(),
  privacy: Privacy,
  containsSyntheticMedia: z.boolean(),
  publishAt: IsoDate.optional(),
  status: z.enum(["uploaded", "scheduled", "published", "failed"]),
  meta: UploadMeta,
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Upload = z.infer<typeof Upload>;

// ---------------------------------------------------------------------------
// Project and Stage (pipeline bookkeeping)
// ---------------------------------------------------------------------------

export const ProjectStatus = z.enum(["active", "waiting", "rejected", "failed", "published"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const Project = z.object({
  id: Id,
  ideaId: Id,
  status: ProjectStatus,
  currentStage: z.string().optional(),
  rejectReason: z.string().optional(),
  dryRun: z.boolean().default(false),
  runId: z.string().optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Project = z.infer<typeof Project>;

export const StageStatus = z.enum(["pending", "running", "waiting", "done", "failed", "skipped"]);
export type StageStatus = z.infer<typeof StageStatus>;

export const Stage = z.object({
  id: Id,
  projectId: Id,
  name: z.string(),
  status: StageStatus,
  inputHash: z.string().optional(),
  providerId: z.string().optional(),
  startedAt: IsoDate.optional(),
  finishedAt: IsoDate.optional(),
  attempt: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
  artifactId: Id.optional(),
  runId: z.string().optional(),
});
export type Stage = z.infer<typeof Stage>;
