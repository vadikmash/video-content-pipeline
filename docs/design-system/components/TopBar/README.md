# TopBar
The sticky app bar: product name, the two destinations, and a right slot.

**Provide:** `active` (`ideas` | `projects`), `items` (defaults to Ideas and Projects; `count` shows a quiet total, `attention` an amber count of projects waiting on you), `right` (usually a `LiveIndicator`).

- The product name is plain text, "VCP" in mono, never a logo.
- Height `topbar-h`; under 520px the "pipeline" suffix hides.
