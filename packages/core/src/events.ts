import { z } from "zod";
import { Id, IsoDate } from "./schemas";

/**
 * Event payloads exchanged between the dashboard and the pipeline.
 * Names are the Inngest event names.
 */
export const EventSchemas = {
  "idea.selected": z.object({ projectId: Id, ideaId: Id }),
  "stage.completed": z.object({ projectId: Id, stage: z.string(), artifactId: Id.optional() }),
  "script.approved": z.object({ projectId: Id, scriptId: Id, version: z.number().int().positive() }),
  "render.approved": z.object({ projectId: Id, renderId: Id }),
  "upload.publish": z.object({ projectId: Id, uploadId: Id, publishAt: IsoDate.optional() }),
  "project.rejected": z.object({ projectId: Id, stage: z.string(), reason: z.string() }),
} as const;

export type EventName = keyof typeof EventSchemas;

export type EventData<N extends EventName> = z.infer<(typeof EventSchemas)[N]>;

/** Shape Inngest's `EventSchemas.fromRecord` expects. */
export type PipelineEvents = {
  [N in EventName]: { data: EventData<N> };
};

export const EVENT_NAMES = Object.keys(EventSchemas) as EventName[];
