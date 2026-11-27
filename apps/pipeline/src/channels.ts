/**
 * Manage channel profiles (publishing destinations).
 *
 *   pnpm channels list
 *   pnpm channels connect --credential YOUTUBE_REFRESH_TOKEN_RU --label "Facts RU" [--default ru]
 *   pnpm channels default ru <channelId|none>
 *   pnpm channels add-unverified --id UC-test --label "Test" [--default en]   # fake publisher only
 *
 * `connect` reads the channel the credential authenticates as (channels.list mine=true) and saves
 * that ID; the ID is never typed by hand for a real channel. Reconnecting an existing channel
 * with a new credential must authenticate as the same ID. Nothing is uploaded or changed on YouTube.
 */
import { LANGUAGES, Language } from "@vcp/core";
import { closeDb, listChannels, setLanguageDefault, upsertChannel } from "@vcp/db";
import { channelForCredential } from "@vcp/provider-publish-youtube";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "list":
    case undefined: {
      const channels = await listChannels();
      if (!channels.length) console.log("No channels connected. Run: pnpm channels connect --credential YOUTUBE_REFRESH_TOKEN --label <name>");
      for (const c of channels) {
        console.log(`${c.channelId}  ${c.label}  (${c.provider}, ${c.credentialRef})${c.defaultFor.length ? `  default for ${c.defaultFor.join(", ")}` : ""}`);
      }
      break;
    }
    case "connect": {
      const credentialRef = flag(args, "credential") ?? "YOUTUBE_REFRESH_TOKEN";
      const label = flag(args, "label");
      if (!label) throw new Error("--label is required");
      const channelId = await channelForCredential(process.env, credentialRef);
      const saved = await upsertChannel({ channelId, provider: "youtube", label, credentialRef });
      console.log(`Connected ${saved.label}: ${saved.channelId} via ${saved.credentialRef}`);
      await maybeDefault(args, channelId);
      break;
    }
    case "add-unverified": {
      const channelId = flag(args, "id");
      const label = flag(args, "label");
      if (!channelId || !label) throw new Error("--id and --label are required");
      const saved = await upsertChannel({ channelId, provider: "fake", label, credentialRef: flag(args, "credential") ?? "YOUTUBE_REFRESH_TOKEN" });
      console.log(`Added unverified ${saved.label}: ${saved.channelId}. Real uploads re-verify it and refuse if the credential does not match.`);
      await maybeDefault(args, channelId);
      break;
    }
    case "default": {
      const [language, channelId] = args;
      const lang = Language.parse(language);
      await setLanguageDefault(lang, !channelId || channelId === "none" ? null : channelId);
      console.log(`Default for ${lang}: ${channelId && channelId !== "none" ? channelId : "none"}. Saved project destinations are unchanged.`);
      break;
    }
    default:
      throw new Error(`unknown command "${command}". Use list, connect, default or add-unverified. Languages: ${LANGUAGES.join(", ")}`);
  }
}

async function maybeDefault(args: string[], channelId: string) {
  const language = flag(args, "default");
  if (!language) return;
  await setLanguageDefault(Language.parse(language), channelId);
  console.log(`Default for ${language}: ${channelId}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
