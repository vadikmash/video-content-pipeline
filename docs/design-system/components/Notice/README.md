# Notice
An inline, persistent message: discovery results, a saved version, a failure that needs attention.

**Provide:** `tone` (`neutral` | `running` | `waiting` | `done` | `failed`), `title`, `children` for detail, optional `onDismiss`.

- After "Source from web": `done` tone, "Sourced 14 ideas", "12 added · 2 skipped as duplicates".
- Notices sit in the flow above what they describe, never float. Dismissible; they don't time out.
