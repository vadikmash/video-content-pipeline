# IdeaRow
One candidate fact in the inbox: status, title, one-liner, tags, expandable why and evidence, and the actions its status allows.

**Provide:** `idea` (`{title, oneLiner, whySurprising, domain, origin, status, score, opinion, evidence[]}`), callbacks `onSelect`, `onShortlist`, `onReject`, `onRestore`, and `projectHref` for selected/done ideas. Optional `defaultOpen`.

- Actions by status: new → Select · Shortlist · Reject; shortlisted → Select · Reject; selected/done → Open project; rejected → Restore (row text drops to `ink-faint`).
- Stack rows inside `.vcp-list`. Under 600px the actions drop below the text as equal-width buttons.
- Score is optional, shown as two decimals in mono. Evidence opens inline, never in a modal.
