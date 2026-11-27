import { EventSchemas } from "@vcp/core";
import { Inngest, eventType } from "inngest";

export const isDev = process.env.INNGEST_DEV !== "0" && process.env.NODE_ENV !== "production";

export const inngest = new Inngest({
  id: "vcp-pipeline",
  isDev,
  ...(process.env.INNGEST_BASE_URL ? { baseUrl: process.env.INNGEST_BASE_URL } : {}),
});

/** Typed, runtime-validated event definitions derived from core's zod schemas. */
export const events = {
  ideaSelected: eventType("idea.selected", { schema: EventSchemas["idea.selected"] }),
  stageCompleted: eventType("stage.completed", { schema: EventSchemas["stage.completed"] }),
  scriptApproved: eventType("script.approved", { schema: EventSchemas["script.approved"] }),
  renderApproved: eventType("render.approved", { schema: EventSchemas["render.approved"] }),
  assetReplace: eventType("asset.replace", { schema: EventSchemas["asset.replace"] }),
  uploadPublish: eventType("upload.publish", { schema: EventSchemas["upload.publish"] }),
  uploadRetarget: eventType("upload.retarget", { schema: EventSchemas["upload.retarget"] }),
  uploadCheck: eventType("upload.check", { schema: EventSchemas["upload.check"] }),
  projectRejected: eventType("project.rejected", { schema: EventSchemas["project.rejected"] }),
  ideasDiscover: eventType("ideas.discover", { schema: EventSchemas["ideas.discover"] }),
};
