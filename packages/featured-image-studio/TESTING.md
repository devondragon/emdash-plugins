# Manual Testing Guide

End-to-end test workflow for `@devondragon/emdash-plugin-featured-image-studio` against a consuming EmDash site in Cloudflare dev mode. No automated tests ship with v0.1 — this doc is the canonical verification checklist until a plugin test harness exists.

> Assumes the consuming site path is `~/git/digitalsanctuary`. Substitute your own.

## 1. Setup (once per testing session)

### 1a. Build the plugin in watch mode

From the plugin monorepo root:

```bash
pnpm -C packages/featured-image-studio dev
```

This runs `tsdown --watch` and rebuilds `dist/` on every source edit (sub-second). Leave this terminal open for the duration of the testing session.

### 1b. Link the plugin into the consuming site

```bash
cd ~/git/digitalsanctuary
pnpm add file:/absolute/path/to/emdash-plugins/packages/featured-image-studio
```

Use an absolute path. pnpm will create a `file:` protocol dep — `node_modules/@devondragon/emdash-plugin-featured-image-studio` resolves to the plugin's built `dist/`, so EmDash's dynamic import of the `entrypoint` specifier works with zero extra configuration.

> ⚠️ Do not commit this `file:` dep. Revert the site's `package.json` / lockfile before pushing.

### 1c. Wire the plugin into the site's `astro.config.mjs`

```ts
import emdash from "emdash";
import { featuredImageStudioPlugin } from "@devondragon/emdash-plugin-featured-image-studio";

export default defineConfig({
  integrations: [
    emdash({
      // ...existing options...
      plugins: [
        // ...existing plugins...
        featuredImageStudioPlugin(),
      ],
    }),
  ],
});
```

### 1d. Obtain an Unsplash Access Key

1. Visit <https://unsplash.com/developers>.
2. Create a new application, accept the API terms.
3. Copy the **Access Key** (NOT the Secret Key — this plugin uses public Client-ID auth only).

Free "Demo" tier: 50 requests/hour. Plenty for manual testing; not for production.

## 2. Run the dev server

Use whichever command matches the consuming site's setup. Both stay local and do NOT touch production:

```bash
# Astro dev (with Cloudflare adapter in dev mode)
pnpm dev

# OR: built worker + wrangler dev
pnpm build && wrangler dev --env dev
```

> **Binding safety check**: if the site's `wrangler.toml` points R2 / D1 bindings at production resources in the default environment, `wrangler dev` without `--env dev` (or `--local`) can read/write prod. Confirm the dev env has its own `r2_buckets` and `d1_databases` entries, or prefer `wrangler dev --local` for full isolation. Media uploads via `ctx.media.upload` write to whatever R2 binding is active when the request runs.

**NEVER** run `wrangler deploy` during testing.

## 3. Test script

Run through in order. Tick each step as it passes.

### 3.1 Plugin registered

- [ ] Admin sidebar shows "Image Studio" with two subpages: `/` (Image Studio) and `/settings` (Settings).

If not visible: restart the dev server. EmDash reads `plugins: []` at config time; new plugin additions require a full restart.

### 3.2 Access Key entry

- [ ] Open the host-chrome settings form for this plugin (surfaced by EmDash from `admin.settingsSchema`). Paste your Unsplash Access Key. Save.

### 3.3 Key validation

- [ ] Open **Plugins → Featured Image Studio → Settings** (the plugin's custom settings page).
- [ ] Click **Test key**. Expect "✓ Key works." (green text).
- [ ] Replace the saved key with a deliberately bad one, save, click Test key again. Expect a red error surfacing the Unsplash 401 ("unauthorized").
- [ ] Restore the good key before continuing.

### 3.4 Stock search

- [ ] Open **Plugins → Featured Image Studio → Image Studio**.
- [ ] Search `mountains`. Expect a grid of thumbnails with photographer credits in the bottom-left of each card.
- [ ] Change orientation filter → search again. Grid updates.
- [ ] Click "Next →" pagination. Grid updates, pager reflects new page number.
- [ ] DevTools → Network: POST to `/_emdash/api/plugins/featured-image-studio/unsplash/search` returns `{ data: { items: [...], total, totalPages, rateLimit: {...} } }`. Status 200.

### 3.5 Import

- [ ] Click any photo card. Expect the card to dim with "Importing…" text.
- [ ] On success: the tab shows a blue info banner at the top — "Imported … photo by <Name>. Media id: `<id>`".
- [ ] Network tab: POST to `/_emdash/api/plugins/featured-image-studio/unsplash/import` returns `{ data: { mediaId, url, attribution: { photographer, sourceUrl, license, providerPhotoId } } }`. Status 200.
- [ ] Navigate to the EmDash media library: the new asset appears with the content-hash dedupe behaviour intact.
- [ ] (Optional) Verify the R2 object exists — via `wrangler r2 object list <bucket>` against the dev bucket, or the Cloudflare dashboard (dev env).
- [ ] (Optional) Verify attribution persistence — query the plugin KV/state table for the key `state:attribution:<mediaId>`; the value should be JSON containing `photographer`, `sourceUrl`, `license: "unsplash"`, `providerPhotoId`, and `importedAt`.

### 3.6 Field widget integration

- [ ] In the consuming site's collection schema, attach the widget to an image field:

  ```ts
  fieldWidgets: {
    featuredImage: "featured-image-studio:picker",
  }
  ```

- [ ] Restart the dev server (schema change).
- [ ] Create or edit a post in that collection. The featured-image field should render the dashed-border widget with a "Browse / Generate" button (in place of the default image picker).
- [ ] Click the button → modal opens → search → click a photo → modal closes → widget shows the imported thumbnail and field label updates to "Image attached. Click Browse to replace."
- [ ] Save the post. Reload the editor. Verify the field value persisted and the thumbnail re-renders.
- [ ] Click "Remove" on the widget; field clears. Save to confirm `null` persists.

### 3.7 Error paths

- [ ] Clear the Unsplash key via the host settings form. Search anything. Expect 400 error: "Unsplash access key not configured. Open the Settings tab and paste your key." (The `StockTab` component detects `code: "missing_key"` and surfaces a friendlier message.)
- [ ] Restore the key. Hammer search 55+ times within an hour. Expect the 51st+ request to surface 403 "rate limit exceeded" with the hint that the free tier is 50/hour.

## 4. Iterating during development

- **UI-only changes** (anything under `src/ui/` or `src/admin.tsx`): tsdown rebuilds → refresh the admin page.
- **Backend changes** (`src/index.ts`, `src/routes/*`, `src/providers/*`): tsdown rebuilds, but **the dev server must be restarted**. EmDash loads plugins at config time and holds the `ResolvedPlugin` reference for the process lifetime.
- **Descriptor / admin config changes** (pages, fieldWidgets, settingsSchema): restart required.

## 5. Cleanup after testing

```bash
cd ~/git/digitalsanctuary
pnpm remove @devondragon/emdash-plugin-featured-image-studio
# revert astro.config.mjs and any schema changes
git diff   # sanity check nothing leaked
git checkout -- astro.config.mjs   # if needed
```

Confirm nothing from the testing session is left in the site's working tree before committing unrelated work.

## 6. Known limitations / expected failures in v0.1

- **AI tab is intentionally disabled.** Clicking it reveals a "Coming in v0.2" placeholder. This is not a bug.
- **Workers AI is not reachable** from this plugin and will not be in any future version until EmDash exposes Cloudflare bindings to third-party plugins. v0.2 AI providers will be HTTP-based (OpenAI / Replicate) with BYOK.
- **Attribution display on the public site** is the theme's responsibility — v0.1 only *stores* the attribution metadata. A helper for rendering it will ship in v0.2.
- **No automated tests.** This document is the test suite until a plugin test harness exists in the monorepo.
