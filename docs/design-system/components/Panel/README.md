# Panel
A bordered section with a title row for each artifact on project detail; optionally collapsible.

**Provide:** `title`, `children`; optional `meta` (mono summary such as "v3 · 88 words"), `status` (stage status badge), `actions`, `collapsible` + `defaultOpen`, `id` for anchors.

- Artifact order on detail: Brief & sources, Script, Narration, Storyboard, Render, Upload.
- Open by default: the panel the current gate asks about. Others collapse to their title and meta.
- An artifact not produced yet shows a compact `EmptyState` naming the stage that will produce it.
