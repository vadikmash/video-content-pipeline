import type {
  Attribution,
  Beat,
  BlobRef,
  Claim,
  Evidence,
  Scene,
  UploadMeta,
  Word,
} from "@vcp/core";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

// ---------------------------------------------------------------------------

export const ideas = pgTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    origin: text("origin").notNull(),
    sourceProvider: text("source_provider"),
    sourceUrl: text("source_url"),
    title: text("title").notNull(),
    oneLiner: text("one_liner").notNull(),
    whySurprising: text("why_surprising").notNull(),
    domain: text("domain").notNull(),
    evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
    opinion: boolean("opinion").notNull().default(false),
    score: real("score"),
    status: text("status").notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [index("ideas_status_idx").on(t.status), index("ideas_domain_idx").on(t.domain)],
);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id")
    .notNull()
    .references(() => ideas.id),
  status: text("status").notNull().default("active"),
  currentStage: text("current_stage"),
  rejectReason: text("reject_reason"),
  dryRun: boolean("dry_run").notNull().default(false),
  runId: text("run_id"),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const stages = pgTable(
  "stages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("pending"),
    inputHash: text("input_hash"),
    providerId: text("provider_id"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    attempt: integer("attempt").notNull().default(0),
    error: text("error"),
    artifactId: text("artifact_id"),
    runId: text("run_id"),
  },
  (t) => [uniqueIndex("stages_project_name_idx").on(t.projectId, t.name)],
);

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export const briefs = pgTable("briefs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  ideaId: text("idea_id")
    .notNull()
    .references(() => ideas.id),
  summary: text("summary").notNull(),
  angle: text("angle").notNull(),
  evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
  sources: jsonb("sources").$type<string[]>().notNull().default([]),
  provider: text("provider").notNull(),
  createdAt: createdAt(),
});

export const scripts = pgTable(
  "scripts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id),
    version: integer("version").notNull(),
    hook: text("hook").notNull(),
    beats: jsonb("beats").$type<Beat[]>().notNull(),
    outro: text("outro").notNull(),
    estimatedSeconds: real("estimated_seconds").notNull(),
    claims: jsonb("claims").$type<Claim[]>().notNull().default([]),
    reviewedBy: text("reviewed_by"),
    provider: text("provider").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("scripts_project_version_idx").on(t.projectId, t.version)],
);

export const narrations = pgTable("narrations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  scriptId: text("script_id")
    .notNull()
    .references(() => scripts.id),
  audioBlob: jsonb("audio_blob").$type<BlobRef>().notNull(),
  words: jsonb("words").$type<Word[]>().notNull().default([]),
  voiceId: text("voice_id").notNull(),
  provider: text("provider").notNull(),
  alignerProvider: text("aligner_provider"),
  durationSec: real("duration_sec").notNull(),
  createdAt: createdAt(),
});

export const storyboards = pgTable(
  "storyboards",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    narrationId: text("narration_id")
      .notNull()
      .references(() => narrations.id),
    version: integer("version").notNull(),
    scenes: jsonb("scenes").$type<Scene[]>().notNull(),
    containsSyntheticMedia: boolean("contains_synthetic_media").notNull().default(false),
    provider: text("provider").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("storyboards_project_version_idx").on(t.projectId, t.version)],
);

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  kind: text("kind").notNull(),
  blob: jsonb("blob").$type<BlobRef>().notNull(),
  provider: text("provider").notNull(),
  licence: text("licence").notNull(),
  attribution: jsonb("attribution").$type<Attribution>().notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  durationSec: real("duration_sec"),
  synthetic: boolean("synthetic").notNull().default(false),
  createdAt: createdAt(),
});

export const renders = pgTable("renders", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  storyboardId: text("storyboard_id")
    .notNull()
    .references(() => storyboards.id),
  templateId: text("template_id").notNull(),
  templateVersion: text("template_version").notNull(),
  blob: jsonb("blob").$type<BlobRef>().notNull(),
  thumbnailBlob: jsonb("thumbnail_blob").$type<BlobRef>(),
  durationSec: real("duration_sec").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  fps: real("fps").notNull(),
  provider: text("provider").notNull(),
  createdAt: createdAt(),
});

export const uploads = pgTable("uploads", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  renderId: text("render_id")
    .notNull()
    .references(() => renders.id),
  provider: text("provider").notNull(),
  remoteId: text("remote_id").notNull(),
  remoteUrl: text("remote_url"),
  privacy: text("privacy").notNull(),
  containsSyntheticMedia: boolean("contains_synthetic_media").notNull().default(false),
  publishAt: ts("publish_at"),
  status: text("status").notNull(),
  meta: jsonb("meta").$type<UploadMeta>().notNull(),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Configuration, quota, audit
// ---------------------------------------------------------------------------

/**
 * One row per (scope, kind, key).
 *  kind="port": key is a PortName, value is a provider id, options is the provider options JSON.
 *  kind="gate": key is a GateName, value is "auto" | "manual".
 * scope="global" or a project id for per-project overrides.
 */
export const providersConfig = pgTable(
  "providers_config",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").notNull().default("global"),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("providers_config_scope_kind_key_idx").on(t.scope, t.kind, t.key)],
);

export const quotaLedger = pgTable(
  "quota_ledger",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    windowKind: text("window_kind").notNull(), // minute | day | month
    windowStart: ts("window_start").notNull(),
    used: integer("used").notNull().default(0),
    limit: integer("limit"),
    resetAt: ts("reset_at"),
    circuit: text("circuit").notNull().default("closed"), // closed | open
    reason: text("reason"),
  },
  (t) => [uniqueIndex("quota_ledger_provider_window_idx").on(t.provider, t.windowKind, t.windowStart)],
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("events_project_idx").on(t.projectId)],
);
