---
"@devondragon/emdash-plugin-404-viewer": patch
---

Render "—" instead of "12/31/1969" when a 404 log entry has no last-seen timestamp.

The summary endpoint returns `MAX(last_seen_at)`, which is NULL for rows written by a
writer that doesn't set the column (EmDash 0.31 migration 035 added it). `timeAgo` passed
that NULL straight to `new Date(null)`, i.e. epoch 0, which rendered as a 1969 date. The
`NotFoundSummary.lastSeen` type claimed `string`, so the case never surfaced at compile
time; it is now `string | null` and `timeAgo` guards both null and unparseable input.
