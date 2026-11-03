# GateBanner
The "paused for you" call to action shown while a project waits at a gate, with approve and reject-with-reason.

**Provide:** `gate` (`script` | `video` | `publish`), `onApprove(opts)` (publish passes `{scheduleAt}`, null for now), `onReject(reason)`. Optional `busy` while the request is in flight, `title` / `description` to override the default copy.

- Sits directly above the artifact it asks you to judge; that panel is open.
- Reject is a ghost button that reveals a required reason; the confirming button is `danger` and says the run stops but data is kept.
- Publish adds an optional schedule field; with a time set the button reads "Schedule".
- Under 520px the approve button fills the row at 44px.
- Reject while a project is active (not at a gate) uses the same reason flow from the header's "Reject…" button.
