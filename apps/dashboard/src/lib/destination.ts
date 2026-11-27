import type { ChannelProfile, Language, Project } from "@vcp/core";
import { findUpload, latestRender } from "@vcp/db";

/**
 * The upload the publish gate shows: the latest render's upload to the saved destination, or a
 * pre-channel upload that publishing binds once the video is verified to be on that channel.
 * Mirrors `currentUpload` in the pipeline.
 */
export async function currentUploadFor(projectId: string, channelId: string | undefined) {
  const render = await latestRender(projectId);
  if (!render) return undefined;
  return (channelId ? await findUpload(projectId, render.id, channelId) : undefined) ?? (await findUpload(projectId, render.id, undefined));
}

/**
 * Stand-in until projects carry a production language (M3 step 1, language half): every
 * project is treated as English for the routing suggestion.
 */
export const STAND_IN_LANGUAGE: Language = "en";

/** Saved destination, else the language default as an unsaved suggestion. */
export function suggestedChannel(project: Project, channels: ChannelProfile[]): { channel?: ChannelProfile; saved: boolean } {
  if (project.channelId) return { channel: channels.find((c) => c.channelId === project.channelId), saved: true };
  return { channel: channels.find((c) => c.defaultFor.includes(STAND_IN_LANGUAGE)), saved: false };
}
