# Button
One verb per button; `primary` (filled `signal`) appears at most once per region.

**Provide:** `children` (a verb naming the result), optional `variant` (`primary` | `secondary` | `ghost` | `danger`, default `secondary`), `size` (`md` 34px | `sm` 28px for in-row actions), `icon` / `iconRight` (an `Icon` name), `href` to render a link, `block` for full width. Other props pass to the `<button>`.

- `primary`: the step that moves the pipeline forward: Approve script, Approve video, Publish, Select, Source from web.
- `secondary`: useful but not the main path: Shortlist, Restore, Download MP4, Edit script.
- `ghost`: Reject…, Cancel, and quiet panel actions.
- `danger`: only the confirming "Reject and stop" after a reason is typed. Never the first click.
- Icon-only buttons need `aria-label`. Heights grow to `control-touch` on coarse pointers automatically.
