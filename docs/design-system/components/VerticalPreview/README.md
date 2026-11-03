# VerticalPreview
The render artifact: a 9:16 video frame at `preview-w` beside its file metadata and downloads.

**Provide:** `src` and `poster` for the MP4 (without `src` a placeholder frame shows `duration` and `caption`), `meta` (MetaList items: resolution, duration, size, codec, render time), `downloadHref`, `thumbnailHref`. `children` render under the buttons.

- The frame is 240 × 427 on wide layouts and never grows to fill the page; under 520px it centres at up to 260px with metadata below.
- The frame sits on `well` (near-black) in both themes.
