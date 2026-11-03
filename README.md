# video-content-pipeline

Modular short-video pipeline. Design: [docs/tech-plan.md](docs/tech-plan.md). Current milestone: **M0** (everything runs on fake providers; nothing paid is called).

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
  providers/   one package per provider; fake-* for every port
```

## Run locally

Prereqs: Node 22+, pnpm 10, Docker, ffmpeg (Remotion downloads its own Chromium on first render).

1. `cp .env.example .env && pnpm install`
2. `pnpm db:up` (Postgres 16 in Docker on :5432)
3. `pnpm db:migrate && pnpm db:seed` (tables + default `providers_config` mapping every port to a fake)
4. `pnpm dev` starts the dashboard (:3000), the pipeline serve endpoint (:3001) and the Inngest dev server (:8288)
5. Open <http://localhost:3000/ideas>, add an idea, click **Select**, then approve each gate on the project page. The final render is a placeholder MP4 previewed in the dashboard.

## Tests

- `pnpm test` runs contract tests for every fake provider plus unit tests.
- `pnpm test:e2e` runs the golden end-to-end: manual idea -> fakes -> real Remotion render -> fake publisher. Needs no database; takes about a minute for the render.
