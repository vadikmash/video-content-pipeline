# Cursor prompt: apply the VCP design system to `apps/dashboard`

Paste everything below the line into Cursor (Agent mode), from the repo root.

---

Restyle the dashboard app (`apps/dashboard`) to follow the VCP design system in `docs/design-system/`. Change only how it looks and is laid out. Data loading, server actions, polling and routes must work exactly as they do now.

## Read first

1. `docs/design-system/README.md`: the rules (status vocabulary, colour use, type, layout, mobile behaviour). Follow it literally.
2. `docs/design-system/preview.html`: open it in a browser. Every component and the five screens (`IdeasInboxScreen`, `IdeasInboxMobile`, `ProjectsScreen`, `ProjectDetailScreen`, `ProjectDetailMobile`) are the visual target.
3. `docs/design-system/components/<Name>/README.md`: per-component guidance (what it takes, when to use it, narrow-screen behaviour).
4. `docs/design-system/components/bundle.css`: the reference CSS for every component, using the `vcp-` class names.
5. `docs/design-system/components/bundle.js`: reference implementation **only**. It is a browser global (`window.VCP`) built with `React.createElement` and ships sample data. Don't import it, copy it in, or load it from a script tag. Port the markup into typed TSX instead.
6. `docs/design-system/tokens.css`: CSS variables for the dark (default) and light themes.
7. `apps/dashboard/AGENTS.md`: this is Next 16 with React 19. Check `node_modules/next/dist/docs/` before using any Next API you're not sure about (fonts, metadata, server actions, `searchParams`).

## Hard constraints

- Don't touch `packages/*`, `apps/pipeline`, `src/lib/*`, any `actions.ts`, the API route, or `Poller`'s behaviour.
- Pages stay server components. Use `"use client"` only where state is needed: the gate's reject toggle, the script editor, the audio player, and the idea row's "why" expander if you don't use `<details>`.
- Every mutation stays a `<form action={serverAction}>` posting the same field names it posts today: `reason` for reject, whatever `saveScriptEdit` and `publishUpload` read, and the `addIdea` fields. Read each action before wiring its form.
- Filters on `/ideas` stay URL search params (`status`, `domain`, `origin`). Build the status filter as a row of `<Link>`s styled as `vcp-segmented`, not client state.
- No Tailwind, no CSS-in-JS, no new UI dependencies. Plain CSS files plus `next/font`.
- Don't use Inter or Roboto anywhere. Remove the old `--panel`, `--border`, `--muted`, `--accent`, `--ok`, `--warn`, `--bad` and `--info` variables, along with every inline `style={{…}}` that used them.

## Steps

1. **Styles**
   - Copy `tokens.css` to `src/app/tokens.css`.
   - Copy `bundle.css` to `src/app/vcp.css`, deleting its first line (the Google Fonts `@import`).
   - Rewrite `globals.css` as just base resets plus anything page-specific the design system doesn't cover.
   - Import them in `layout.tsx` in this order: tokens, vcp, globals.
2. **Fonts**: load IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500/600) with `next/font/google`. Point `--font-sans` and `--font-mono` at them: set the variables on `<html>`, or override the two variables in `tokens.css` to reference the next/font variables.
3. **Theme**: `<html data-theme="dark">` by default. A light/dark toggle is optional. If you add one, keep it a tiny client component that stores the choice in `localStorage` and avoids a flash on load.
4. **Components** go in `src/components/ui/`, one file per component, typed from `docs/design-system/components/index.d.ts`.
   - Port: `Icon`, `Button` (renders a `Link` when given `href`, and a `<button type="submit">` when used inside a form), `StatusBadge`, `Tag`, `StageStrip`, `StageRail`, `GateBanner`, `IdeaRow`, `ProjectList`/`ProjectRow`, `ProjectHeader`, `ScriptView`, `StoryboardTable`, `VerticalPreview`, `AudioPlayer`, `Panel`, `MetaList`, `Notice`, `LiveIndicator`, `Segmented` (link-based), `Field`/`Input`/`Textarea`/`Select`/`Checkbox`, `EmptyState`, `TopBar`.
   - Keep the exact `vcp-` class names so `vcp.css` applies unchanged.
   - Take stage order and labels from `STAGES` / `isGate` in `@vcp/core`. Don't hardcode a second list.
5. **Layout** (`layout.tsx`): replace `nav.top` with `TopBar`.
   - Keep the "Inngest dev UI" link in the right slot as a ghost `Button` with the `external` icon.
   - Show the Projects attention count (waiting projects) if it's cheap to query from the layout. Otherwise leave it out.
   - Wrap pages in `.vcp-page`.
6. **`/ideas`** (target: `IdeasInboxScreen` and `IdeasInboxMobile`):
   - Page head: "Ideas" with "Source from web" as the primary button (still the `discoverIdeas` form) and "Add idea" as secondary.
   - Discovery result: a `done`-tone `Notice` built from the `sourced`, `skipped` and `via` params. Title "Sourced N ideas", body "N added · M skipped as duplicates · via `<via>`". It dismisses by linking to the same URL without those params.
   - Toolbar: the link-based status `Segmented` with counts if available, then Domain and Origin `Select`s in a GET form that submits on change. A tiny client wrapper is fine for that, or keep an "Apply" button.
   - The idea list goes in `.vcp-list` with one `IdeaRow` each. The action buttons are the existing per-idea forms: `selectIdea`, `shortlistIdea`, `rejectIdea`, `restoreIdea`. Keep the existing dry-run select option if the page has one, as a secondary or ghost button. Selected and done ideas link to their project.
   - The manual add-idea form becomes a `Panel` with `Field`s, collapsed by default (`<details>` or a query param), placed above the list.
7. **`/projects`** (target: `ProjectsScreen`): `ProjectList`, sorted waiting → active → newest, with the title from the idea. The empty state links to `/ideas`.
8. **`/projects/[id]`** (targets: `ProjectDetailScreen` and `ProjectDetailMobile`):
   - `ProjectHeader`: idea title, one-liner, id, status, `StageStrip`, and a `LiveIndicator` while `active` or `waiting`. Show a `dry run` `Tag` when `project.dryRun`.
   - `project.rejectReason` → a `failed` `Notice` under the header.
   - Two-column `.vcp-detail`: on the left, `aside.vcp-detail-rail.vcp-detail-rail--wide` holding the `StageRail`; on the right, the stack. Under 900px, put the same rail inside a collapsed `Panel` titled "Stages", using the `.vcp-detail-rail--narrow` class, placed after the gate banner.
   - `GateBanner` for `approve-script` / `approve-video` / `approve-publish`. Approve is a form posting to `approveScript` / `approveVideo` / `publishUpload`; publish keeps whatever schedule or privacy fields `publishUpload` reads. Reject reveals a reason field that posts `reason` to `rejectProject`.
   - While the project is `active` with no gate, put a ghost "Reject…" in the header's actions slot, using the same reason flow.
   - Panel order:
     - at `approve-script`: Script (open, editable) → Brief & sources → everything else.
     - at `approve-video`: Render (open) → Storyboard (open) → Narration → Script → Brief.
     - at `approve-publish`: Upload (open) → Render → the rest.
     - otherwise: pipeline order.
   - A panel with no artifact yet shows a compact `EmptyState` naming the stage that produces it.
   - Script: use `ScriptView`'s look for the read view and restyle the existing `ScriptEditor` into its edit mode, posting to `saveScriptEdit` and labelling the save button with the next version ("Save v3"). Show `reviewedBy` and a hand-edited `Tag` (`provider === "user-edit"`) in the panel meta.
   - Narration: `AudioPlayer` with a real `<audio>` source (`blobUrl(narration.audioBlob.key)`). Meta: duration · words · provider (+ aligner).
   - Storyboard: `StoryboardTable` from `storyboard.scenes` and the `assets` map (thumbnail, attribution). Show a `synthetic media` `Tag` (tone `waiting`) when `containsSyntheticMedia`.
   - Render: `VerticalPreview` with the real `<video>` and poster. Meta: resolution `width × height @ fps`, duration, provider, template `id@version`. Download links as they work today.
   - Upload: `MetaList` with privacy as a badge, `remoteId` (mono, copyable), provider, title, description and tags.
   - Keep `<Poller enabled={live} />`.

## Mapping real data to the design

| Real field | Design prop |
| --- | --- |
| `Stage.status` | `StatusBadge kind="stage"` / rail status. Map any value outside `pending/running/waiting/done/failed` to the nearest one, and say which in a code comment |
| `Stage.providerId` | rail `provider` |
| `Stage.startedAt`/`finishedAt` | rail `duration`, formatted `38s`, `1m 54s` (not `114.0s`) |
| `Stage.attempt > 1` | append `· attempt N` to rail meta |
| `Stage.runId` | rail `logsHref` → `${INNGEST_BASE_URL}/run?runID=…` |
| `Stage.error` | rail `error` (verbatim) |
| `Project.status` | `StatusBadge kind="project"` (active, waiting, published, rejected, failed) |
| `Idea.status` | `StatusBadge kind="idea"` |
| `Idea.origin` | `Tag` with the `web` icon (research) or `edit` icon (manual) |
| claim `sourceUrl` + `confidence` | `sourced` badge when `sourceUrl` is present, else `unsourced`; show confidence as mono `82%` after the claim text, in `failed` colour below 60% |
| `createdAt` | relative text in lists ("12m ago"), absolute in `title` |

## Done when

- `pnpm --filter @vcp/dashboard typecheck` and `pnpm --filter @vcp/dashboard build` pass.
- `/ideas`, `/projects` and `/projects/[id]` (check each gate state, plus a failed and a published project) match the matching screens in `preview.html` at 1200px and at 390px. No horizontal page scroll at 390px. Gate approve buttons reach 44px tall on touch.
- Status is readable without colour: every status shows a glyph and its fixed word.
- Approve, reject with a reason, script edit/save, select/shortlist/reject/restore, add idea, source from web and publish all still work end to end against the local stack.
- No leftover old CSS variables, inline colour styles, or Inter/Roboto references (`rg -n "var\(--(panel|border|muted|accent|ok|warn|bad|info)\)|Inter|Roboto" apps/dashboard/src` returns nothing).

Work in small commits: styles + fonts, primitives, ideas page, projects page, detail page. After each page, run the dev server and compare it against `preview.html` before moving on.
