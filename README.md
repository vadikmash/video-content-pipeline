# video-content-pipeline

Modular short-video pipeline. Design: [docs/tech-plan.md](docs/tech-plan.md). Current milestone: **M1** (real script, ElevenLabs voice, typography render, private YouTube upload). Fakes stay bound until you opt in; nothing paid is called by default.

## Layout

```
apps/
  dashboard/   Next.js: Ideas inbox, Projects, gates
  pipeline/    Inngest functions (one per stage) + HTTP serve endpoint
  renderer/    Remotion project (FactShort composition)
packages/
  core/        zod schemas, ports, events, stage contracts, provider registry
  db/          Drizzle schema, migrations, seed, repositories
  limits/      rate-limit ledger (stub in M0)
  providers/   one package per provider; fake-* for every port, plus M1 real adapters
```

## Run locally

Prereqs: Node 22+, pnpm 10, Docker, ffmpeg (Remotion downloads its own Chromium on first render).

1. `cp .env.example .env && pnpm install`
2. `pnpm db:up` (Postgres 16 in Docker on :5432)
3. `pnpm db:migrate && pnpm db:seed` (tables + default `providers_config` mapping every port to a fake)
4. `pnpm dev` starts the dashboard (:3000), the pipeline serve endpoint (:3001) and the Inngest dev server (:8288)
5. Open <http://localhost:3000/ideas>. Use **Source from web** (or add an idea by hand), click **Select**, optionally edit the script at the approve-script gate, then approve each gate. The final render is a placeholder MP4 previewed in the dashboard.
6. First Remotion render downloads Chrome Headless Shell; run `pnpm browser:ensure` beforehand if needed.

## Real providers (M1)

Seed still maps every port to a fake. `pnpm providers:bind` rewrites a port only when its key is present in `.env`:

- `OPENAI_API_KEY` binds `TextModel` to `llm-openai`. `LLM_PROVIDER=anthropic` plus `ANTHROPIC_API_KEY` binds `llm-anthropic` instead.
- `ELEVENLABS_API_KEY` binds `Speech` and `Aligner`. Set `ELEVENLABS_VOICE_ID`.
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN` bind `Publisher`. Run `pnpm youtube:auth` once to print a refresh token (it is not written for you). The OAuth client needs redirect URI `http://127.0.0.1:8765/callback`. It asks for the `youtube` scope: `youtube.upload` alone can upload but not publish. Set the Google OAuth app's publishing status to **In production**; apps left in **Testing** get refresh tokens that expire after seven days, and publishing then fails with `invalid_grant`.

Hand-pick an idea that has an evidence URL other than its origin post (or mark it as opinion), click **Select**, then approve the script, the video, and publish. Upload is private. Nothing is public until the last gate. Drop a music file you have rights to at `apps/renderer/public/bed.mp3` if you want a ducked bed under the narration. Without that file the render is voice only.

Dry-run projects keep using fakes for every paid port.

## Tests

- `pnpm test` runs contract tests for every fake provider plus unit tests.
- `pnpm test:e2e` runs the golden end-to-end: manual idea -> fakes -> real Remotion render -> fake publisher. Needs no database; takes about a minute for the render.
- `REAL_PROVIDERS=1` (with `.env` exported) also runs the contract tests against OpenAI, Anthropic and ElevenLabs; providers without a key are skipped. `YOUTUBE_CONTRACT=1 YOUTUBE_CONTRACT_FILE=<short mp4>` adds YouTube: it **uploads a real video to the channel** (private, switched to unlisted and back) and spends daily quota, so delete the video afterwards.
