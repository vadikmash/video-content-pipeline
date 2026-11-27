import { z } from "zod";
import { Id, IsoDate, StoryboardVisual } from "./schemas";

/**
 * Event payloads exchanged between the dashboard and the pipeline.
 * Names are the Inngest event names.
 */
export const EventSchemas = {
  "idea.selected": z.object({ projectId: Id, ideaId: Id }),
  "stage.completed": z.object({ projectId: Id, stage: z.string(), artifactId: Id.optional() }),
  "script.approved": z.object({ projectId: Id, scriptId: Id, version: z.number().int().positive() }),
  "render.approved": z.object({ projectId: Id, renderId: Id, requestId: Id.optional() }),
  "asset.replace": z.object({
    projectId: Id, renderId: Id, requestId: Id, beatId: Id, visual: StoryboardVisual,
  }),
  /** Approval to publish `uploadId`; with publishAt (a UTC instant) it schedules, in the reviewer's publishTimeZone. */
  "upload.publish": z.object({
    projectId: Id,
    uploadId: Id,
    publishAt: IsoDate.optional(),
    publishTimeZone: z.string().min(1).optional(),
  }),
  /** The destination changed while waiting to publish: upload the approved render to the new channel. */
  "upload.retarget": z.object({ projectId: Id, channelId: z.string().min(1), requestId: Id }),
  /** Read a scheduled upload's remote status now. */
  "upload.check": z.object({ projectId: Id, uploadId: Id }),
  "project.rejected": z.object({ projectId: Id, stage: z.string(), reason: z.string() }),
  "ideas.discover": z.object({ limit: z.number().int().positive().optional() }),
} as const;

export type EventName = keyof typeof EventSchemas;

export type EventData<N extends EventName> = z.infer<(typeof EventSchemas)[N]>;

/** Shape Inngest's `EventSchemas.fromRecord` expects. */
export type PipelineEvents = {
  [N in EventName]: { data: EventData<N> };
};

export const EVENT_NAMES = Object.keys(EventSchemas) as EventName[];
