# 404-viewer: Create Redirect from 404 Log

**Status**: Draft
**Date**: 2026-04-08
**Package**: `@devondragon/emdash-plugin-404-viewer`

## Problem

The 404-viewer plugin surfaces paths users are hitting that don't resolve.
Today, fixing a 404 means: note the path → leave the plugin → navigate to the
core EmDash redirects page → manually type the path → save. That's the exact
kind of friction the plugin-ideas catalog flagged as the "closes the loop with
404-viewer" win.

The originally-sketched standalone `redirects-manager` plugin is unnecessary
because core EmDash already ships a full redirects CRUD API (`/_emdash/api/
redirects`), schema, pattern matching, hit tracking, and an admin page. The
high-value gap is the "click a 404 → create a redirect" flow — and it belongs
inside 404-viewer, not a separate plugin.

## Scope

Add a per-row "Create Redirect" action to both the Summary and Full Log views
of the existing 404-viewer plugin. Clicking opens a modal that posts to
`POST /_emdash/api/redirects` with the 404 path prefilled as the source.

**In scope (v1):**

- Per-row Create Redirect button in Summary + Log views
- Modal with source, destination, type (301/302/307/308), enabled, pattern toggle
- Destination autosuggest backed by `/_emdash/api/search?q=...`
- Role-gated UI (hide button unless the current user can manage redirects)
- Checkbox "Clear matching 404 log entries" (see "Cleanup" below; v1 is a soft
  no-op with explanatory copy — see Followups)

**Out of scope:**

- Bulk "create redirect for multiple paths at once"
- CSV/regex import
- Editing or deleting existing redirects (core admin already handles that)
- Unit/integration tests (matches existing plugin convention; add opt-in later)
- Changes to core EmDash

## Background: what core provides

Verified against `github.com/emdash-cms/emdash@main`:

- Migration `029_redirects.ts` creates `_emdash_redirects` with `source`,
  `destination`, `type`, `is_pattern`, `enabled`, `hits`, `last_hit_at`,
  `group_name`, `auto`, timestamps.
- `POST /_emdash/api/redirects` — create. Body: `{source, destination,
  type?, enabled?, groupName?}`. Requires `redirects:manage` perm.
- `createRedirectBody` Zod schema in `api/schemas/redirects.ts`: validates
  `source`/`destination` are local paths (start with `/`, no `//`, no CRLF,
  no `..`), rejects `source === destination`, accepts types 301/302/307/308,
  pattern validation via `redirects/patterns.ts` (Astro route syntax:
  `[param]`, `[...splat]`).
- `GET /_emdash/api/auth/me` returns `{id, email, name, role, avatarUrl,
  isFirstLogin}`. `role` is a numeric level.
- `packages/auth/src/rbac.ts`: `redirects:manage` requires `Role.ADMIN`.
- `GET /_emdash/api/search?q=...` returns `SearchResult[]` with
  `{collection, id, slug, title, snippet, score}`. Sufficient for
  destination autosuggest (slug only — not full URL; see Caveats).
- `POST /_emdash/api/redirects/404s` (prune) only takes `{olderThan}`.
  **No path-scoped filter.** Confirmed by reading the route handler.

## Architecture

Single-file change: `packages/404-viewer/src/admin.tsx`. No new files, no
new dependencies, no new peer deps. The file is structured as a series of
small units, each with one purpose:

### Units

1. **API helpers** (append to the existing API Helpers section):
   - `createRedirect(input: CreateRedirectInput): Promise<Redirect>` — thin
     wrapper over `apiFetch` + `parseApiResponse`.
   - `fetchCurrentUserRole(): Promise<string | number | null>` — `GET
     /_emdash/api/auth/me`, returns `role` or `null` on failure.
   - `searchPostSuggestions(q: string, signal?: AbortSignal):
     Promise<PostSuggestion[]>` — `GET /_emdash/api/search?q=...&limit=8`,
     maps results to `{id, title, collection, slug}`.

2. **`<CreateRedirectModal>`** — presentational modal component. Props:
   `{ open: boolean; initialSource: string; onClose: () => void; onSuccess:
   () => void }`. Owns form state. Uses Kumo `Dialog` (or whatever modal
   primitive Kumo exposes — verify at implementation time; fall back to a
   portal-less overlay if Kumo has no `Dialog`). Layout:

   - **Source** (text input, prefilled)
   - **Destination** (text input with autosuggest dropdown, see below)
   - **Type** (select: 301 Permanent / 302 Found / 307 Temporary /
     308 Permanent)
   - **Enabled** (checkbox, default on)
   - **Use as pattern** (checkbox, default off) — when on, swaps helper
     text to explain Astro route syntax, hides autosuggest
   - **Clear matching 404 log entries** (checkbox, default on — see
     "Cleanup" below)
   - **Submit** / **Cancel** buttons
   - Inline error region for API errors

3. **`<DestinationAutosuggest>`** — controlled input + dropdown. Debounces
   user input by 250ms, fires `searchPostSuggestions` with an `AbortController`
   so stale queries don't overwrite fresh ones. Dropdown shows up to 8 items:
   each item displays `{title}` bold, `/{collection}/{slug}` muted. Clicking
   an item fills the destination field with `/${slug}` (see Caveats on why
   slug-only). Only rendered when `isPattern === false`.

4. **Role gate** — `NotFoundPage` grows a new piece of state
   `canManageRedirects: boolean`, populated by a `useEffect` that calls
   `fetchCurrentUserRole()` once on mount. Truthy iff the role equals
   `"admin"` or the numeric level matches admin (implementation detail:
   check the actual `role` shape returned by `/auth/me` at implementation
   time — if it's a string like `"admin"`, string-compare; if numeric, use
   the known admin level from core). On any failure, defaults to `false`
   (safe hide).

5. **Row actions** — both `SummaryView` and `LogView` grow a new rightmost
   cell containing a compact "→ Redirect" `Button` (Kumo `variant="outline"
   size="sm"` or equivalent). The button is only rendered when
   `canManageRedirects` is true. Clicking calls a `onCreateRedirect(path)`
   callback passed in from `NotFoundPage`, which sets modal state and opens
   the modal.

6. **Modal state in `NotFoundPage`** — new state:
   `{ modalOpen: boolean; modalSource: string }`. `onCreateRedirect(path)`
   sets both. `onSuccess` closes the modal and refreshes the active view
   (`loadSummary()` or `loadLog()`).

### Data flow

```
User clicks "→ Redirect" on a 404 row
  → onCreateRedirect(path)
  → setModalOpen(true); setModalSource(path)
  → <CreateRedirectModal open initialSource={path} />
    → User fills destination (optionally via autosuggest)
    → User optionally toggles "Use as pattern" / adjusts type
    → User submits
      → createRedirect({source, destination, type, enabled, isPattern?})
        → 201 Created
          → onSuccess()
            → refresh current view
            → close modal
            → (see Cleanup below for the "clear matching 404s" checkbox)
        → 4xx
          → setError(parsedMessage); modal stays open
```

### Pattern toggle behavior

- Off (default): source is the exact 404 path, pre-filled from the row.
  User can still edit it (e.g. normalize trailing slash). Destination is
  a literal path; autosuggest is shown.
- On: source and destination become free-text; helper text explains
  `[param]` and `[...rest]`. Autosuggest is hidden because patterns need
  manual splat mapping, not slug completion.
- Client-side pre-validation is light — server re-validates in all cases.

### Permission UX

- Hide all "→ Redirect" buttons and the modal entry points when
  `canManageRedirects` is false.
- If `/auth/me` returns 401 or network-errors, default to hidden.
- No separate "you don't have permission" toast — the UI simply doesn't
  offer the action. This matches the existing plugin's low-chrome approach.

### Cleanup (the "Clear matching 404 log entries" checkbox)

Core's 404 prune endpoint only accepts `{olderThan}`, not a path filter.
That means a true "delete 404 rows for this specific path" action would
require either (a) a core API change or (b) N individual DELETEs, which
core also doesn't expose.

**v1 behavior**: the checkbox is rendered, defaults to on, but on success
the plugin shows explanatory copy inline in the success state:

> "Redirect created. Matching 404 log entries will stop accumulating as
> soon as requests start resolving. (Per-path cleanup is pending a core
> API change — see issue #XYZ.)"

If the box is unchecked, skip that copy. The box is kept in the UI so the
interaction matches the eventual ideal and so the design doesn't need a
second pass when core ships the filter.

**Followup**: file an issue on `emdash-cms/emdash` proposing `path?: string`
(and maybe `pathPrefix?: string`) on `notFoundPruneBody`. Once shipped, the
plugin calls the endpoint with `{olderThan: new Date().toISOString(), path}`
when the checkbox is on, and drops the explanatory copy.

### Error handling

- Form uses `getErrorMessage` from `emdash/plugin-utils` so server-
  provided Zod messages (e.g. "Source and destination must be different")
  are shown verbatim.
- Network failures show a generic "Could not reach server" message.
- `alert()` / `confirm()` are NOT introduced for the new flow — all modal
  feedback is inline. (The existing prune/clear flows still use
  `alert`/`confirm`; leaving them alone — out of scope.)

## Caveats

1. **Destination autosuggest fills `/${slug}`, not the true permalink.**
   Core's search endpoint doesn't return resolved URLs — it returns the
   entry's slug and collection. A post at
   `/blog/2024/my-post` that has slug `my-post` in collection `blog` will
   autosuggest-fill `/my-post`, which the user will usually need to edit
   to `/blog/my-post` (or similar, depending on their collection routes).
   The dropdown shows `/{collection}/{slug}` as a muted hint so users
   aren't surprised. This is acceptable for v1 per agreement during
   design. A future improvement is a "resolve permalink" endpoint.

2. **No test coverage.** Matches current plugin convention. Adding a
   Vitest setup is a separate, opt-in change.

3. **Role check is a single request at mount time.** If the user's role
   changes mid-session, they'll see stale UI until reload. Acceptable.

## Files touched

- `packages/404-viewer/src/admin.tsx` — all additions above
- `packages/404-viewer/CHANGELOG.md` — changeset entry
- `packages/404-viewer/README.md` — add a short "Create redirects from
  the log" section
- `.changeset/<new>.md` — minor bump for `@devondragon/emdash-plugin-404-viewer`
- `packages/404-viewer/package.json` — no version bump (handled by changeset)

## Non-changes (explicit)

- No new package / no new monorepo workspace
- No changes to core EmDash
- No new peer dependencies
- No changes to the existing Summary/Log fetching or clear/prune flows
- No tests introduced

## Followups (post-merge)

1. File issue on `emdash-cms/emdash`: add `path?: string` filter to
   `POST /_emdash/api/redirects/404s` prune body. Once shipped, wire the
   "Clear matching 404 log entries" checkbox to actually call it.
2. Consider a "resolve permalink" helper in core so the destination
   autosuggest can show real URLs, not slugs.
3. Bulk "create redirect for all 404s matching pattern X" flow — would
   be very useful for big migrations, but keep v1 small.
