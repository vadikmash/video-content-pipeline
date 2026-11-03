VCP is a one-operator workbench for turning surprising facts into vertical short videos. Every screen answers one question first: **what is waiting on me?** Density and legibility beat decoration; status is read in a glance, by colour *and* glyph *and* word.

## Principles

- **The pipeline is the interface.** Eleven stages, three of them gates. Show where a project is with `StageStrip` (rows, headers) and `StageRail` (detail). Never hide stages that haven't run; show them pending.
- **Gates read as "paused for you".** A project waiting at a gate is the only place `waiting` amber appears in volume: the `GateBanner`, the waiting rail row, the badge. If amber is on screen, the operator owes a decision.
- **One action colour.** `signal` fills exactly one primary button per region (Approve, Select, Source from web). Everything else is `secondary` or `ghost`.
- **Reject is always reachable, never loud.** Reject is a `ghost` button that opens a reason field; only the confirming button is `danger`. Copy reminds that data is kept.
- **Live, not loud.** Polling shows as `LiveIndicator` (a small pulsing `running` dot and "updated 4s ago"). No spinners over content, no toasts for routine updates.

## Content

- Sentence case everywhere: "Approve script", "Source from web", "Open project". Labels in uppercase only via `t-label`.
- Buttons are verbs naming the result: "Approve video", "Reject and stop", "Save v4". Never "OK", "Submit", "Confirm".
- Address the operator as *you* sparingly ("Paused for you"); system copy is plain and factual: "12 added · 2 skipped as duplicates".
- Status words are fixed. Stage: Pending, Running, Paused for you, Done, Failed. Project: Active, Waiting on you, Published, Rejected, Failed. Idea: New, Shortlisted, Selected, Done, Rejected.
- Stage keys, providers, durations, versions, ids and scores are data: set them in `t-mono` (`approve-script`, `claude · 38s`, `v3`, `0.91`).
- Times: relative in lists ("2h ago"), absolute on hover and in detail (`2026-11-03 14:22`). Durations `1m 54s`, media time `0:41`.
- No emoji. No exclamation marks.

## Colour

- Dark is the default theme; light is complete and equal. Ground is `bg`; content sits on `surface` with `line` hairlines. Inputs and media players are `surface-sunken`; video and thumbnails sit on `well` (near-black in both themes).
- Text: `ink` for primary, `ink-muted` for secondary, `ink-faint` for tertiary on `surface`/`bg` only.
- Status uses five tones, each a text colour plus a `*-tint` fill: `running` (blue), `waiting` (amber), `done` (teal), `failed` (red), and neutral (`ink-muted` on `surface-raised` with a `line` ring). Pending is neutral and outlined.
- Every status carries a glyph: pending ○, running ◐, waiting ‖, done ✓, failed ×. `done` leans teal and differs from `failed` in lightness and glyph, so the pair never depends on red/green hue.
- `signal` and `waiting` share a hue in dark mode on purpose: the gate and the button that clears it look related.
- Focus: 2px solid `focus` ring, 2px offset, on every interactive element.

## Type

- IBM Plex Sans for interface text, IBM Plex Mono for data (Google Fonts; `components/bundle.css` imports both). Fallbacks are the system stacks in `--font-sans` / `--font-mono`.
- Scale: `t-display` 24/30 (one per screen), `t-title` 17/24, `t-heading` 15/20, `t-body` 14/20, `t-small` 12/16, `t-label` 11/16 caps; data in `t-mono` 12/16 and `t-mono-sm` 11/14 with tabular numerals.
- Weights 400, 500 (buttons, labels), 600 (titles). No italics in UI chrome; quoted evidence may use `<q>`.

## Space, shape, depth

- 4px grid: `space-1`…`space-7`. Rows pad `space-3` × `space-4`; panels stack with `space-3`; the detail grid gaps `space-5`.
- Radii are small and squared: `radius-sm` badges/tags, `radius-md` controls, `radius-lg` panels and the video frame. No pills except the live dot and audio play button.
- Borders, not shadows. `shadow-pop` is for menus only.
- Controls are `control-md` (34px) on desktop, `control-sm` (28px) inside rows, and grow to `control-touch` (44px) on coarse pointers.

## Layout

- Top bar (`TopBar`, `topbar-h`) with two destinations: Ideas, Projects. The Projects link carries an amber count when something waits on you.
- Pages: `.vcp-page` (max 1240px, `space-5` gutter, `space-4` under 640px).
- Project detail: `.vcp-detail` two columns — stage rail (280px, sticky) and a stack of artifact panels. Under 900px it becomes one column: header with `StageStrip`, then the `GateBanner`, then a collapsed "Stages" panel holding the rail, then artifacts.
- The gate banner always sits directly above the artifact it asks you to judge (script at approve-script, render at approve-video, upload at approve-publish), and that panel is open by default.
- The 9:16 preview is `preview-w` wide (240 × 427) beside its metadata; under 520px it centres at up to 260px with metadata below. It never fills the page.
- Components respond to their container (`container-type: inline-size`), not the viewport, so a row behaves the same in a list, a panel or a phone.

## Motion

- 120ms colour/border transitions on controls; the running glyph rotates; the live dot pulses at 2s. All motion stops under `prefers-reduced-motion`.

## Iconography

- A small built-in set drawn on a 24px grid, 2px round strokes, `currentColor` (`Icon`: check, x, pause, pending, running, dot, star, play, download, external, chevron, plus, search, restore, log, alert, clock, copy, arrow, web, edit). Icons always accompany a word, except icon-only buttons, which carry an `aria-label`.

## Brand mark

- There is no logo. The product name is set as plain text: **VCP** in IBM Plex Mono 600, followed by "pipeline" in `ink-faint`.
