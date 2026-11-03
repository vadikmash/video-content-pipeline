# StageStrip
A compact 11-segment progress bar with the current stage named, for rows, headers and narrow screens.

**Provide:** `stages` (array of `{key, status}`; omitted stages are pending). Optional `showLabel={false}` when the stage name is shown nearby.

- Segments: outlined = pending, teal = done, blue = running, amber = waiting at a gate, red = failed. Gate segments are taller.
- The current segment gets an `ink` outline; when all eleven are done the label reads "Published".
- Minimum width 88px. Below that, show only the label.
