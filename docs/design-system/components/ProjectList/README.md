# ProjectList
The projects table: title and one-liner, stage strip, status and created time, each row linking to detail.

**Provide:** `projects` (`{id, title, oneLiner, status, stages, created, createdAt}`), `hrefFor(project)`. With no projects it shows an empty state pointing to the ideas inbox (`ideasHref`), or your own `empty` node.

- Sort waiting projects first, then active, then by created time; amber should rise to the top.
- `created` is relative ("12m ago"); `createdAt` is the absolute tooltip.
- Under 640px rows become two lines: title and status, then strip and time. `ProjectRow` renders a single row.
