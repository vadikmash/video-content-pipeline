# ProjectHeader
The top of project detail: breadcrumb with id, idea title and one-liner, project status, current stage and a stage strip.

**Provide:** `id`, `title`, `oneLiner`, `status`, `stages`. Optional `live` (a `LiveIndicator`) and `actions` (e.g. a ghost "Reject…" while active).

- The title is the only `t-display` text on the page.
- Under 560px the side slot drops below the title and the strip runs full width.
