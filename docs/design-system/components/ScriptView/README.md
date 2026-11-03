# ScriptView
The script artifact: hook, numbered beats with visual-kind tags, outro and claims with sourcing status, plus an inline editor that saves a new version.

**Provide:** `script` (`{version, words, duration, hook, beats[{text, visual}], outro, claims[{text, status, source}]}`), `editable` (true only at approve-script), `onSave(nextScript)` (receives `version + 1`).

- "Edit script" swaps the read view for textareas and a visual-kind select per beat; save is labelled with the new version ("Save v3"). Never auto-save.
- Unsourced claims show in `failed` red so they're caught before approval.
- Under 480px the visual-kind tag moves under the beat text.
