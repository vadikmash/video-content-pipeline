# Tech plan: modular short-video pipeline

Original design dated 2026-11-03. Sections 1–9 describe the intended architecture, including capabilities still to build. M2 merged at `b2c165f`. The implementation audit and current delivery order are in the [M3 production plan](m3-production-plan.md). Historical provider research is in the [research notes](research-short-video-pipeline.md).

## 1. Verdict

Build it. The three things you asked for are not sold together: ideas you explicitly select (yours or researched), a pipeline where every provider is swappable, and a dashboard with a hold before anything goes public. Existing products (InVideo, Syllaby, Revid, MoneyPrinterTurbo) are good for learning the format in week one and are worth a few hours each. None of them gives you the control surface you described.

The risk is not technical. It is building a framework instead of a channel. Two rules keep it honest:

1. A port (interface) exists only where a second real provider is plausible today. No abstract "AnyAPI" layer.
2. One video template until ten videos have shipped. Modularity lives in the providers and the pipeline, not in the edit.

## 2. Shape

```
apps/
  dashboard/        Next.js: ideas, projects, reviews, providers, runs
  pipeline/         Inngest functions (one per stage) + HTTP serve endpoint
  renderer/         Remotion project: compositions + local render CLI
packages/
  core/             domain types, zod schemas, port interfaces, stage contracts
  db/               Drizzle schema + migrations (Postgres)
  providers/
    source-manual, source-wikimedia, source-reddit, source-youtube
    llm-openai, llm-anthropic (same port; swap by config)
    tts-elevenlabs, tts-edge
    align-elevenlabs, align-whisper (local, optional)
    stock-pixabay, stock-pexels (possible later adapter)
    image-flux, image-openai
    clip-kling, clip-gemini-omni (optional, last)
    render-remotion, render-shotstack (optional, later)
    publish-youtube
    blob-local, blob-s3
    fake-*            deterministic fakes for every port, used by tests and dry runs
  limits/           rate-limit ledger, circuit breaker, backoff, header parsing
```

TypeScript end to end. Remotion is React and runs on Node, Inngest's primary SDK is TypeScript, and the dashboard is a web app, so a second language only adds a process boundary. If you later want local Whisper or a Python-only model, it becomes one more provider behind a small HTTP shim.

## 3. The contract that makes swapping cheap

Everything flows through typed artifacts stored in Postgres (metadata) and a blob store (files). Providers never talk to each other; they read one artifact and produce the next. The artifact schemas are the stable surface. Providers are disposable.

```
Idea        -> ScoredIdea      -> (select)  -> Brief
Brief       -> Script          -> (approve) -> Narration (audio + word timings)
Narration   -> Storyboard      -> AssetBundle -> RenderedVideo
RenderedVideo -> (approve)     -> Upload (private) -> (publish) -> Published
```

Core schemas (zod, in `packages/core`):

```ts
Idea {
  id, origin: "manual" | "research", sourceProvider?, sourceUrl?,
  title, oneLiner, whySurprising, domain: "history" | "science" | ...,
  evidence: { url, quote }[],      // what the source said, verbatim
  status: "new" | "shortlisted" | "selected" | "rejected" | "done",
  createdAt
}

Script {
  ideaId, version, hook, beats: Beat[], outro, estimatedSeconds,
  claims: { text, sourceUrl, confidence }[],   // every factual sentence maps to one
  reviewedBy?: "user" | "auto"
}

Beat { id, text, visual: VisualIntent }
VisualIntent =
  | { kind: "type" }                                   // kinetic typography
  | { kind: "stock", query, orientation: "portrait" }
  | { kind: "still", prompt, style }
  | { kind: "clip", prompt, seconds }
  | { kind: "diagram", spec }                          // rendered in Remotion, no provider

Narration { scriptId, audioBlob, words: { text, start, end }[], voiceId, provider }

Storyboard { narrationId, scenes: { beatId, start, end, visual: VisualIntent, assetId? }[] }

Asset { id, kind: "video" | "image" | "audio", blob, provider, licence,
        attribution: { text, url }, width, height, durationSec? }

Render { storyboardId, templateId, templateVersion, blob, durationSec, provider }

Upload { renderId, provider: "youtube", remoteId, privacy: "private" | "unlisted" | "public",
         containsSyntheticMedia: boolean, publishAt?, status }
```

Ports (interfaces) in `packages/core/ports.ts`:

```ts
interface IdeaSource    { id; discover(ctx: DiscoverCtx): Promise<Idea[]> }
interface TextModel     { id; generate<T>(schema: ZodType<T>, prompt: Prompt): Promise<T> }
interface WebResearch   { id; search(q): Promise<{ url, title, snippet }[]>; fetch(url): Promise<string> }
interface Speech        { id; synthesize(text, voice): Promise<{ audio: Blob; words?: Word[] }> }
interface Aligner       { id; align(audio, text): Promise<Word[]> }
interface StockSearch   { id; search(q, opts): Promise<Asset[]>; fetch(asset): Promise<Blob> }
interface ImageGen      { id; generate(prompt, opts): Promise<Asset> }
interface ClipGen       { id; generate(prompt | image, seconds, opts): Promise<Asset> }
interface Renderer      { id; render(storyboard, bundle, template): Promise<Render> }
interface Publisher     { id; upload(render, meta, privacy): Promise<Upload>;
                          setPrivacy(upload, privacy, publishAt?): Promise<Upload>;
                          status(upload): Promise<Upload> }
interface BlobStore     { put(key, bytes, contentType): Promise<BlobRef>; get(ref); url(ref, ttl) }
```

Every provider also exports a `ProviderManifest`:

```ts
{
  id: "stock-pixabay", port: "StockSearch",
  env: ["PIXABAY_KEY"],
  limits: { perMinute: 100, cacheSeconds: 86400, concurrency: 2 },
  attributionRequired: true,
  costModel: { unit: "request", approxUsd: 0 }
}
```

A planned Providers page will display these manifests. The current persistent quota hooks cover real stock and image adapters.

Provider selection is data, not code. A `pipeline_config` row maps each port to a provider id plus options. The config repository supports per-project overrides. The current binding CLI can select ElevenLabs or OpenAI speech. Dashboard configuration is planned.

What does not swap cleanly: the renderer. A Remotion template and a Shotstack JSON edit are different things. The storyboard schema is the contract both read, so a second renderer is possible, but it will not be pixel-identical. Accept that and treat Remotion as the template owner.

## 4. Pipeline

Inngest, one function per stage, each stage a `step.run` with retries. Human stops are `step.waitForEvent` with a long timeout, so a run can sit for days at no cost. The script, video and publish gates default to manual. The runner supports auto mode through stored configuration. Dashboard toggles are planned.

```
cron 06:00      discover           every enabled IdeaSource; dedupe; write Idea rows
on idea.created score              TextModel ranks surprise / sourceability / showability
                                   dedupe vs. your own past ideas (embedding similarity)
GATE            select             you click Select; emits idea.selected
on idea.selected
  research      WebResearch + TextModel -> Brief with evidence quotes
  write         TextModel -> Script v1 with claims; source filter checks claim URLs
GATE            approve-script     you edit in the dashboard; emits script.approved {version}
  voice         Speech -> audio; Aligner -> word timings if Speech did not return them
  storyboard    TextModel maps beats to VisualIntent using the word timings
  assets        per scene: stock -> still -> clip, in that order of preference; attribution kept
  render        Renderer with template v1; thumbnail frame exported too
GATE            approve-video      preview in dashboard; emits render.approved
  upload        Publisher.upload privacy=private, containsSyntheticMedia from storyboard
GATE            publish            you choose now / publishAt; emits upload.publish
  publish       Publisher.setPrivacy
```

Rules that matter:

- Idempotency: every step keys its output on `(projectId, stage, inputHash)`. Re-running a project after a provider swap re-executes only stages whose input or provider changed.
- Versions: scripts and storyboards are append-only rows. The dashboard shows diffs between versions.
- Rejection at any gate writes a reason to the project and stops the run. Nothing is deleted.
- Originality: an idea reaches `shortlisted` only if (a) it is not within similarity threshold of a past idea and (b) the research step found at least one source that is not the idea's own origin post. Manual ideas skip (b) if you mark them "opinion".
- Disclosure: if any scene used `clip` or a photoreal `still` depicting a real place, person, or event, `containsSyntheticMedia` is set and the dashboard says so before upload. Stylized stills and typography do not trigger it.

## 5. Staying inside every provider's limits

`packages/limits` is the one place rate rules live. Providers call `limits.acquire(providerId, cost)` before every outbound request; the call blocks or throws `Deferred` so Inngest retries later.

Three mechanisms, all driven by the manifest:

1. Inngest function config: `concurrency` keyed by provider id and `throttle` for per-minute ceilings, so parallel runs cannot stampede one API.
2. A `quota_ledger` table: `(provider, window_start, window_kind, used, limit, reset_at)`. Updated from response headers where present (`X-RateLimit-Remaining` on Pixabay and Pexels; Google's quota is tracked by counting). Daily buckets reset at the provider's stated time (YouTube: midnight Pacific).
3. Circuit breaker: on 429 or quota-exceeded, the provider is marked `open` until `Retry-After` or the next reset. Steps touching it defer; the Providers page shows a red state and the reason. No automatic key rotation, ever. That is the behaviour that gets accounts banned.

Per-provider notes the adapters encode:

- YouTube Data API: 100 `videos.insert` and 100 `search.list` per day, 10,000 units for the rest. Discovery uses `videos.list chart=mostPopular` (1 unit) and `playlistItems.list`, never `search.list`. Uploads are resumable so a dropped connection resumes instead of spending another insert. `privacyStatus` is always set explicitly; the default is public. OAuth app should be set to "In production" status even while unverified; apps left in "Testing" get refresh tokens that expire after seven days (verify against Google's current OAuth docs when you set it up).
- Reddit: OAuth script app, unique descriptive User-Agent, 100 queries per minute, register the app before 12 Jan 2027. Read only. Cache listings; a once-daily pull of a few subreddits is well under limits. Commercial use of the content itself needs Reddit's separate agreement; the pipeline stores evidence quotes and links, not reposted bodies.
- Wikimedia: feed and REST endpoints, descriptive User-Agent with contact, modest rate, zero-padded dates. CC BY-SA attribution for quoted text.
- Pixabay: 100 requests per minute, responses cached 24 hours (required by their terms), files downloaded to your blob store rather than hotlinked, attribution shown wherever results appear. Pexels is a possible future adapter. Verify access before implementing it.
- ElevenLabs: plan-based character quota and concurrency; the ledger counts characters per month and warns at 80 percent. Forced alignment is a separate call with its own cost.
- LLMs and image models: provider SDK retry with backoff; the ledger counts tokens for cost display rather than enforcement.

## 6. Dashboard

Next.js, server components plus server actions, Postgres as the only source of truth. Progress comes from stage rows the pipeline writes; the UI polls every few seconds on active pages. No websocket work until polling hurts.

Pages:

- Ideas: inbox of researched ideas with score, origin, evidence; manual add; Select / Reject / Shortlist. Filters by domain and source. This is the only place a video can start.
- Projects: one per selected idea; a stage rail (discover → … → published) with state, duration, cost, provider used, retry count; artifacts per stage; error detail when a step fails.
- Review: script editor with claims and sources beside it; storyboard strip with asset thumbnails and a "replace asset" action that re-runs one scene; video preview; approve / reject with reason; upload metadata (title, description with attribution block, tags, disclosure flag).
- Providers: port → provider mapping; env key present or missing; quota meters from the ledger; circuit state; manifest limits.
- Runs: link to the Inngest run for each project, plus a log view.

## 7. Renderer

One Remotion project with a `FactShort` composition: 1080×1920, 30 fps, 45–60 s. Props are the storyboard plus asset URLs. Scenes are React components keyed by `VisualIntent.kind`: typography, Ken Burns on a still, cropped stock with a slow push, diagram scenes drawn in SVG, short phrase captions, optional music ducked under narration, and source credits in the publish description. Rendering runs locally first (`npx remotion render`), then in a container worker with Chromium and FFmpeg, then Remotion Lambda only if a single worker falls behind. Remotion is free for an individual, including automation; check the licence if a team forms.

## 8. Data and infrastructure

- Postgres (Drizzle): `ideas`, `projects`, `stages`, `scripts`, `narrations`, `storyboards`, `assets`, `renders`, `uploads`, `providers_config`, `quota_ledger`, `events`.
- Blob store behind `BlobStore`: local disk in development, S3-compatible bucket in deployment. Never the app server's disk in production.
- Phase 1 runs entirely on your Mac: Postgres in Docker, Inngest dev server, Next dev server, local Remotion render.
- Phase 2: dashboard and pipeline on one host (Render, Fly, or a small VPS), managed Postgres, S3 or R2, a render worker container. Secrets stay in env; the dashboard shows presence, not values.

## 9. Testing

- Contract tests per port, run against both the fake and the real provider (real ones gated behind an env flag).
- A golden end-to-end test: manual idea → fake providers → a real Remotion render of a placeholder video → fake publisher. Runs locally against the work stages. CI and a full dashboard-to-orchestrator test are planned.
- `dry-run` mode on any project: executes everything up to render with fakes for paid providers, so you can check a storyboard without spending credits.

## 10. Milestones

| Stage | Status and outcome |
| --- | --- |
| M0 · Local skeleton | Shipped. Manual Ideas inbox, local orchestration and persistence, provider fakes and a golden render path. |
| M1 · Real production stages | Shipped the source-backed script workflow, real voice/alignment, local Remotion renderer, private YouTube upload and manual publishing gate. |
| M2 · Visual production | Shipped Pixabay, GPT Image, storyboard planning, stock/still replacement, and quota/circuit handling for stock and image generation. Four bilingual reference cuts used additional manual work. |
| **M3 · Repeatable bilingual production** | **Next.** Linked cuts, editable explanations, quick previews, designed covers, licensed music selection and version-specific private upload from the dashboard. See the [implementation order and release rehearsal](m3-production-plan.md). |
| M4 · Discovery and research | Former M3 scope. Build real sources and web research, scoring and semantic deduplication behind the existing inbox, manual trigger and daily cron. |
| M5 · Operations, deployment and feedback | Former M4 scope. Deploy with access control, migration and deployment CI, shared storage, recovery and observability. Harden scheduling and add YouTube Analytics feedback per idea and language cut. |

## 11. Decisions already made and why

- TypeScript monorepo: Remotion forces Node; one language, one process model.
- Inngest over a cron script: durable steps, retries, and a human gate that costs nothing while waiting. Trigger.dev or Temporal are drop-in alternatives in concept; the stage functions are thin so switching is a day of work.
- Postgres over a document store: versions, diffs, and a quota ledger are relational problems.
- Stock before generation: cheaper, faster, and YouTube's disclosure rule never applies.
- Explicit selection gate: it is both your product requirement and the thing that keeps the channel out of the inauthentic-content bucket.

## 12. Open choices

M3 defaults to one channel, optional Russian siblings for English cuts, manual approvals and voice-only output unless a licensed track is selected. A soundtrack reference, a spatial explanation for the first 3D trial and an intended release time support channel acceptance. Hosting and discovery auto-shortlisting decisions belong to later milestones. [Channel owner input](m3-production-plan.md#input-from-the-channel-owner)

## 13. Technical debt

| Item | Disposition |
| --- | --- |
| Thumbnail / cover and quick video preview | M3. Create an editable portrait cover plus a quick lower-resolution preview before full rendering. The current full-render JPEG is a poster frame. Verify how the chosen cover appears on Shorts. |
| Background music | M3. Reuse local looping, fades and speech ducking. Add per-cut track upload/selection, audition, levels and license/credit metadata. |
| 3D animations | After M3 storyboard authoring, trial one reusable spatial explanation against the existing 2D path. |
| Black Forest Labs FLUX and fal FLUX | Optional. The existing BFL adapter requires live authentication and generation verification. fal needs implementation plus retry/quota verification. GPT Image is the primary still provider. |
| Operational and provider breadth | Carry real discovery, research, scoring, scheduling verification, provider budgets, configuration and run views, deployment, analytics and optional adapters into the [post-M3 backlog](m3-production-plan.md#work-after-m3). |
