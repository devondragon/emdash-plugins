# @devondragon/emdash-plugin-404-viewer

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
