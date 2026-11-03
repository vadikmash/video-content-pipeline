# Field
A labelled form control with hint and error; `Input`, `Textarea`, `Select` and `Checkbox` are its controls.

**Provide:** `label`, a control as `children`, optional `hint`, `error` (replaces the hint), `optional` flag. `Checkbox` takes `label` and `hint` itself. `Select` takes `options`.

- The manual "Add idea" form: Title, One-liner, Why surprising, Domain (select), Evidence (optional textarea, one URL or quote per line), "This is an opinion" checkbox.
- Inputs sit on `surface-sunken` with a `line-strong` border; 16px text on touch devices so phones don't zoom.
