import * as db from "@vcp/db";
import type { Store } from "./types";

/** Postgres-backed store: a thin adapter over @vcp/db repositories. */
export const dbStore: Store = {
  getIdea: db.getIdea,
  setIdeaStatus: db.setIdeaStatus,

  getProject: db.getProject,
  updateProject: db.updateProject,
  loadPipelineConfig: (projectId) => db.loadPipelineConfig(projectId),

  getStage: db.getStage,
  upsertStage: db.upsertStage,

  insertBrief: db.insertBrief,
  latestBrief: db.latestBrief,

  insertScript: db.insertScript,
  getScript: db.getScript,
  latestScript: db.latestScript,
  nextScriptVersion: db.nextScriptVersion,
  markScriptReviewed: db.markScriptReviewed,

  insertNarration: db.insertNarration,
  latestNarration: db.latestNarration,

  insertStoryboard: db.insertStoryboard,
  updateStoryboard: db.updateStoryboard,
  latestStoryboard: db.latestStoryboard,
  nextStoryboardVersion: db.nextStoryboardVersion,

  insertAsset: db.insertAsset,
  getAssets: db.getAssets,

  insertRender: db.insertRender,
  latestRender: db.latestRender,

  insertUpload: db.insertUpload,
  updateUpload: db.updateUpload,
  getUpload: db.getUpload,
  latestUpload: db.latestUpload,

  logEvent: db.logEvent,
};
