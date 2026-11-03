# Segmented
A single-choice switch with counts, used for the status filter on the ideas inbox.

**Provide:** `options` (`{value, label, count?}`), `value` + `onChange` (or `defaultValue`), `label` for screen readers.

- Order: All, New, Shortlisted, Selected, Done, Rejected. Counts in mono.
- On narrow screens it scrolls horizontally inside its own box; the page never scrolls sideways.
