ALTER TABLE "ideas" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "ideas_dedupe_key_idx" ON "ideas" USING btree ("dedupe_key");