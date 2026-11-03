# Project detail — /projects/[id]
The main work surface, shown waiting at approve-video. Header, then two columns: the sticky stage rail (280px) and the artifact stack, led by the gate banner and the panel it asks about.

- Panel order follows what you need to judge now: the gated artifact first (open), then the rest of the pipeline's outputs in reverse (collapsed), and the next artifact (Upload) as a compact empty state.
- At approve-script the order is Script (editable) → Brief & sources → later stages empty. At approve-publish it is Upload → Render → the rest.
- Polling: `LiveIndicator` in the header updates every few seconds; the rail and strip update in place without reflow.
- Reject is in the gate banner; while active between gates, a ghost "Reject…" sits in the header's actions.
