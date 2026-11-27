CREATE TABLE "channel_language_defaults" (
	"language" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"credential_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "publish_time_zone" text;--> statement-breakpoint
ALTER TABLE "channel_language_defaults" ADD CONSTRAINT "channel_language_defaults_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_project_render_channel_idx" ON "uploads" USING btree ("project_id","render_id","channel_id");