# StoryboardTable
The storyboard: one row per beat with time range, visual kind and description, a 9:16 asset thumbnail and attribution.

**Provide:** `rows`: `{beat, time, kind, visual, thumb?, assetStatus?, assetName?, attribution?}`. Without `thumb`, the tile shows the kind (ready), a dashed ring (missing) or a red alert (failed).

- Attribution is mandatory for stock and archive assets; "—" means none needed.
- Under 560px the table becomes stacked rows with the thumbnail on the right.
