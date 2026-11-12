# Agent notes

Setup, layout and the run steps are in [README.md](README.md); the design is in [docs/tech-plan.md](docs/tech-plan.md). This file holds what you would otherwise learn the hard way.

## Checks

- `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (real Remotion render, about a minute). There is no lint or pre-commit hook.
- Real providers: `REAL_PROVIDERS=1` contract tests in `packages/providers/all` call OpenAI, Anthropic, and ElevenLabs. They need `.env` exported (`set -a; . ./.env; set +a`). Providers without an API key are skipped. YouTube is behind its own flag, `YOUTUBE_CONTRACT=1` plus `YOUTUBE_CONTRACT_FILE=<short mp4>`. It uploads a real (private, then unlisted, then private again) video and spends daily quota, so run it only when asked.
- A change with runtime behaviour gets checked in the running dashboard, not just in tests: drive the gates, look at the render (`ffprobe`, extracted frames), and confirm side effects at the source (for example, the YouTube Data API for privacy).

## Running a second copy (worktrees)

The main checkout usually has `pnpm dev` up on :3000, :3001 and :8288. A worktree should use its own ports and database instead of stopping those:

- Copy `.env`, then set `DATABASE_URL=.../vcp_m1` (create the database with `docker exec vcp-postgres psql -U vcp -d vcp -c "create database vcp_m1"`), `PIPELINE_PORT=3101`, `INNGEST_BASE_URL=http://localhost:8298`, and `DASHBOARD_URL=http://localhost:3100`.
- Start the three processes with the env exported: `tsx src/server.ts` (apps/pipeline), `inngest-cli dev -p 8298 -u http://localhost:3101/api/inngest --no-discovery`, and `next dev -p 3100` (apps/dashboard). `next dev` does not read the root `.env` by itself.
- The pipeline server does not hot-reload. Restart it after changing pipeline or provider code.

## Gotchas

- `pnpm providers:bind` overwrites the global port bindings in the database it points at. Run it after changing `LLM_PROVIDER` or keys.
- Provider HTTP failures throw `ProviderError` (`packages/core/src/errors.ts`). A 4xx other than 408 or 429 is permanent, and the Inngest wrapper fails the stage on attempt 1. Keep new providers on `ProviderError` so a bad key or a missing scope doesn't burn retries.
- YouTube: publish and schedule call `videos.update`, which needs the full `youtube` OAuth scope. `youtube.upload` alone uploads fine and then fails at the Publish gate with a 403. `videos.update` also replaces the whole `status` object, so `setPrivacy` reads the current status and merges into it; otherwise `embeddable` and `publicStatsViewable` get reset. The OAuth app must be **In production**, because Testing-mode refresh tokens expire after 7 days.
- YouTube uploads are idempotent per render: `publish-youtube` keeps `uploads/publish-youtube/<renderId>.json` in the blob store (the session URL before any bytes, then the video id). Delete that record only if you really want the render uploaded again.
- ElevenLabs: `voice_settings` replaces the voice's saved settings wholesale, so `tts-elevenlabs` reads them first (this needs the key's voices_read permission) and overrides only `speed`. Forced alignment needs the `forced_alignment` permission.
- Anthropic: current models reject forced `tool_choice` with a 400. `llm-anthropic` uses structured outputs (`output_config.format`) instead.
- Remotion: with `<Audio loop>`, the `volume` callback's frame restarts every loop. Compute envelopes from `useCurrentFrame()` (`apps/renderer/src/music.ts`).
- Narration pauses are shortened with ffmpeg after synthesis (`apps/pipeline/src/audio/pauses.ts`). Use temp files, not pipes: piped MP3 output keeps encoder padding, which puts the voice about 25ms behind the word timings.
- Approved look and pace: big centred one-word captions in Impact (Anton bundled as the fallback, Latin only), voice speed 1.1, pauses capped at 0.25s. Change these only on request.
