# @devondragon/emdash-plugin-404-viewer

## 0.4.0

### Minor Changes

- dd96381: Support EmDash 1.3 and `@cloudflare/kumo` 2.x. The `@cloudflare/kumo` peer is now `^2.6.0` (the version EmDash 1.x ships), which removes the `missing peer @cloudflare/kumo@^1.0.0` warning, and the `emdash` peer floor is now `>=1.0.0`.

  Also fixes two admin UI bugs: "Load more" in the full log view never appeared because the plugin read `cursor` instead of the API's `nextCursor`, and the "→ Redirect" buttons were hidden from admins because the role check required level 80 while EmDash's admin role is 50.

## 0.3.2

### Patch Changes

- 4ae9f93: Render "—" instead of "12/31/1969" when a 404 log entry has no last-seen timestamp.

  The summary endpoint returns `MAX(last_seen_at)`, which is NULL for rows written by a
  writer that doesn't set the column (EmDash 0.31 migration 035 added it). `timeAgo` passed
  that NULL straight to `new Date(null)`, i.e. epoch 0, which rendered as a 1969 date. The
  `NotFoundSummary.lastSeen` type claimed `string`, so the case never surfaced at compile
  time; it is now `string | null` and `timeAgo` guards both null and unparseable input.

## 0.3.1

### Patch Changes

- f6399a3: Relax emdash peer dependency from `^0.1.0` to `>=0.1.0` to support emdash 0.2.0 through 0.4.0+

## 0.3.0

### Minor Changes

- 94941e1: Add "Create Redirect" flow: admins can now convert a 404 log entry into a redirect rule via a modal, without leaving the plugin page. Supports exact paths, Astro-style patterns, destination autosuggest from the search API, and 301/302/307/308 types.

## 0.2.1

### Patch Changes

- 75cc67a: Cleanup admin UI:

  - Use `apiFetch` consistently for all API calls (including GETs) so reads work if EmDash ever gates read endpoints on the `X-EmDash-Request` header.
  - Fix error handling in `catch` blocks: narrow `unknown` with `err instanceof Error` instead of `e.message` on `any`, avoiding `"Error: undefined"` when non-Error values are thrown.
  - Stop refetching the log on every search-input keystroke. `loadLog` no longer closes over `search`; instead search is passed explicitly via the form submit handler, keeping `loadLog`'s identity stable and eliminating the useEffect thrash.
  - Replace native `alert` / `confirm` / `prompt` with Kumo `Dialog` (alertdialog role) for the Clear All and Prune flows, with an inline dismissible success banner for result messages.

## 0.2.0

### Minor Changes

- 0fc3b15: Initial public release of the 404 log viewer plugin
