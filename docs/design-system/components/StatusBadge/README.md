# StatusBadge
A tinted badge with glyph and fixed word, for any status in the system.

**Provide:** `status` and `kind` (`stage` default, `project`, `idea`, `claim`). Optional `size="sm"` inside rows, `bare` to drop the fill, `label` to override the word (rare; keep the fixed vocabulary).

- Stage: pending ○ · running ◐ · waiting ‖ "Paused for you" · done ✓ · failed ×.
- Project: Active · Waiting on you · Published · Rejected · Failed.
- Idea: New · Shortlisted · Selected · Done · Rejected.
- Never colour text by status without the glyph and word; the badge is how status is read.
