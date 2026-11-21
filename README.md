# video-content-pipeline

Local production pipeline for vertical factual Shorts. **M2 shipped** storyboard planning, stock and illustrated scenes, asset replacement and bilingual diagram rendering. Four reference cuts in English and Russian reached YouTube with additional manual production work. **M3 is planned** to let an editor make one Short in a chosen language, review a quick preview and cover, select a soundtrack and upload to a chosen YouTube channel. A second language can be requested separately. [M3 production plan](docs/m3-production-plan.md) · [Architecture and milestones](docs/tech-plan.md)

## Layout

```
apps/
  dashboard/   Next.js: Ideas inbox, Projects, gates
  pipeline/    Inngest functions (one per stage) + HTTP serve endpoint
  renderer/    Remotion project (FactShort composition)
packages/
  core/        zod schemas, ports, events, stage contracts, provider registry
  db/          Drizzle schema, migrations, seed, repositories
  limits/      rate-limit deferrals and circuit breakers
  providers/   one package per provider; fake-* for every port, plus real adapters
```

## Run locally

Prereqs: Node 22+, pnpm 10, Docker, ffmpeg (Remotion downloads its own Chromium on first render).

1. `cp .env.example .env && pnpm install`
2. `pnpm db:up` (Postgres 16 in Docker on :5432)
3. `pnpm db:migrate && pnpm db:seed` (tables and default provider bindings)
4. `pnpm dev` starts the dashboard (:3000), the pipeline serve endpoint (:3001) and the Inngest dev server (:8288)
5. Open <http://localhost:3000/ideas>. Add an idea by hand or use **Source from web** for fixture ideas, click **Select**, optionally edit the script at the approve-script gate, then approve each gate. The dashboard previews the Remotion render, and the fake publisher keeps the upload local.
6. First Remotion render downloads Chrome Headless Shell; run `pnpm browser:ensure` beforehand if needed.

## Real providers

The seed uses local Remotion and local blob storage with fake content providers and publisher. Real providers are opt-in. Run `pnpm providers:bind` with the relevant settings in `.env`.

- `OPENAI_API_KEY` binds `TextModel` to `llm-openai`. `LLM_PROVIDER=anthropic` plus `ANTHROPIC_API_KEY` binds `llm-anthropic` instead.
- `TTS_PROVIDER=openai` with `OPENAI_API_KEY` binds conversational narration and word alignment. The default voice is Marin at speed 1.03. Set `OPENAI_TTS_VOICE` or `OPENAI_TTS_MODEL` to customize it. The default `TTS_PROVIDER=elevenlabs` uses `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. With `ELEVENLABS_MODEL=eleven_v3`, delivery uses natural pacing and stability 0.5.
- `PIXABAY_KEY` binds `StockSearch` to Pixabay. Searches are cached for 24 hours. Selected portrait clips are downloaded to the project blob store.
- `OPENAI_API_KEY` also binds `ImageGen` to GPT Image. If Pixabay has no clip, GPT Image generates an illustration. Set `OPENAI_IMAGE_MODEL` to override the default `gpt-image-2`.
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN` bind `Publisher`. Run `pnpm youtube:auth` once to print a refresh token (it is not written for you). The OAuth client needs redirect URI `http://127.0.0.1:8765/callback`. It asks for the `youtube` scope: `youtube.upload` alone can upload but not publish. Set the Google OAuth app's publishing status to **In production**; apps left in **Testing** get refresh tokens that expire after seven days, and publishing then fails with `invalid_grant`.

Hand-pick an idea that has an evidence URL other than its origin post (or mark it as opinion), click **Select**, then approve the script, the video, and publish. Upload is private. Nothing is public until the last gate. Drop a music file you have rights to at `apps/renderer/public/bed.mp3` if you want a ducked bed under the narration. Without that file the render is voice only.

Dry-run projects keep using fakes for every paid port.

The authored lunar-eclipse and orbital-freefall diagrams support English and Russian labels. Each cut uses its own narration timings and bundled Latin/Cyrillic Inter captions. M3 will add language selection, optional adaptations and diagram authoring to the dashboard.

At video review, expand **Replace asset** on a stock or still scene. Enter new search terms or an illustration prompt and select **Replace and render**. The dashboard opens the new preview at the same approval gate. Pixabay and GPT Image record usage in Postgres and defer jobs after a rate-limit response.

## Tests

- `pnpm test` runs contract tests for every fake provider plus unit tests.
- `pnpm test:e2e` runs the golden end-to-end: manual idea -> fakes -> real Remotion render -> fake publisher. Needs no database; takes about a minute for the render.
- `REAL_PROVIDERS=1` (with `.env` exported) also runs contract tests for configured OpenAI text, Anthropic, ElevenLabs, and Pixabay adapters. `OPENAI_IMAGE_CONTRACT=1` runs one paid image generation when `OPENAI_API_KEY` is set. `YOUTUBE_CONTRACT=1 YOUTUBE_CONTRACT_FILE=<short mp4>` adds YouTube: it **uploads a real video to the channel** (private, switched to unlisted and back) and spends daily quota, so delete the video afterwards.
