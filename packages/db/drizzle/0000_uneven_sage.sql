CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"blob" jsonb NOT NULL,
	"provider" text NOT NULL,
	"licence" text NOT NULL,
	"attribution" jsonb NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"duration_sec" real,
	"synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"idea_id" text NOT NULL,
	"summary" text NOT NULL,
	"angle" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"source_provider" text,
	"source_url" text,
	"title" text NOT NULL,
	"one_liner" text NOT NULL,
	"why_surprising" text NOT NULL,
	"domain" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opinion" boolean DEFAULT false NOT NULL,
	"score" real,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"script_id" text NOT NULL,
	"audio_blob" jsonb NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_id" text NOT NULL,
	"provider" text NOT NULL,
	"aligner_provider" text,
	"duration_sec" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"idea_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_stage" text,
	"reject_reason" text,
	"dry_run" boolean DEFAULT false NOT NULL,
	"run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"window_kind" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"limit" integer,
	"reset_at" timestamp with time zone,
	"circuit" text DEFAULT 'closed' NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "renders" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"storyboard_id" text NOT NULL,
	"template_id" text NOT NULL,
	"template_version" text NOT NULL,
	"blob" jsonb NOT NULL,
	"thumbnail_blob" jsonb,
	"duration_sec" real NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"fps" real NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"idea_id" text NOT NULL,
	"version" integer NOT NULL,
	"hook" text NOT NULL,
	"beats" jsonb NOT NULL,
	"outro" text NOT NULL,
	"estimated_seconds" real NOT NULL,
	"claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_by" text,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_hash" text,
	"provider_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"attempt" integer DEFAULT 0 NOT NULL,
	"error" text,
	"artifact_id" text,
	"run_id" text
);
--> statement-breakpoint
CREATE TABLE "storyboards" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"narration_id" text NOT NULL,
	"version" integer NOT NULL,
	"scenes" jsonb NOT NULL,
	"contains_synthetic_media" boolean DEFAULT false NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"render_id" text NOT NULL,
	"provider" text NOT NULL,
	"remote_id" text NOT NULL,
	"remote_url" text,
	"privacy" text NOT NULL,
	"contains_synthetic_media" boolean DEFAULT false NOT NULL,
	"publish_at" timestamp with time zone,
	"status" text NOT NULL,
	"meta" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrations" ADD CONSTRAINT "narrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrations" ADD CONSTRAINT "narrations_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renders" ADD CONSTRAINT "renders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renders" ADD CONSTRAINT "renders_storyboard_id_storyboards_id_fk" FOREIGN KEY ("storyboard_id") REFERENCES "public"."storyboards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboards" ADD CONSTRAINT "storyboards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboards" ADD CONSTRAINT "storyboards_narration_id_narrations_id_fk" FOREIGN KEY ("narration_id") REFERENCES "public"."narrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_project_idx" ON "events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ideas_status_idx" ON "ideas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ideas_domain_idx" ON "ideas" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "providers_config_scope_kind_key_idx" ON "providers_config" USING btree ("scope","kind","key");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_ledger_provider_window_idx" ON "quota_ledger" USING btree ("provider","window_kind","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "scripts_project_version_idx" ON "scripts" USING btree ("project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_project_name_idx" ON "stages" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "storyboards_project_version_idx" ON "storyboards" USING btree ("project_id","version");