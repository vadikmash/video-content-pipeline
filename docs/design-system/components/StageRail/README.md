# StageRail
The full vertical list of all 11 stages with status, provider, duration, logs link and error, the spine of project detail.

**Provide:** `stages`: `{key, status, provider?, duration?, logsHref?, error?}` per stage that has run. Labels and gate flags come from `VCP.STAGES`.

- Gate stages have square nodes and a "Gate" tag. A waiting gate row is filled `waiting-tint`, outlined amber and says "Paused for you".
- A running row is tinted blue and its glyph rotates (static under reduced motion).
- A failed row shows the error verbatim in mono under the label, and its logs link stays.
- Place it in `.vcp-detail-rail` (280px, sticky) on wide screens; under 900px put it inside a collapsed `Panel` titled "Stages".
