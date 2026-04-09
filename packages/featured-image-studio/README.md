# @devondragon/emdash-plugin-featured-image-studio

EmDash plugin that turns picking a featured image into a single unified experience: search Unsplash, pick a photo, and the plugin imports it into your media library — attribution and all. Works as a standalone admin page *and* as an in-editor field widget.

> **v0.1 scope**: Stock search via **Unsplash** only. An "AI Generation" tab is present but disabled (planned for v0.2 via BYOK OpenAI Images / Replicate). Workers AI is not currently reachable from distributed EmDash plugins, so AI providers will be HTTP-based.

## Requirements

- EmDash `^0.1.0`
- React `^19`
- An Unsplash **Access Key** (free tier — [apply here](https://unsplash.com/developers))

## Installation

```bash
pnpm add @devondragon/emdash-plugin-featured-image-studio
```

## Usage

In your `astro.config.mjs`:

```ts
import { defineConfig } from "astro/config";
import emdash from "emdash";
import { featuredImageStudioPlugin } from "@devondragon/emdash-plugin-featured-image-studio";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [featuredImageStudioPlugin()],
    }),
  ],
});
```

Then:

1. Open **Plugins → Image Studio** in the EmDash admin and switch to the **Settings** tab to paste your Unsplash Access Key.
2. Switch to the **Stock (Unsplash)** tab on the same page to search and import images directly into the media library.

### Using it inside the Post editor

**The post editor does not pick this up automatically.** EmDash stores a per-field `widget` setting in its database and only renders a plugin widget on fields that have been explicitly opted in. The plugin registers the widget name `featured-image-studio:picker`; you still need to bind it to each `image` / `file` field you want it to take over.

The supported path is the EmDash admin UI:

1. Open **Collections** in the EmDash admin sidebar.
2. Edit the collection that owns your featured image (e.g. `posts`).
3. Edit the `image` / `file` field and set its **Widget** to `featured-image-studio:picker`.
4. Save. Reload the post editor — that field now renders the "Browse / Generate" button that opens the Studio modal.

If you prefer to script it (e.g. in a seed or migration), the same binding can be written directly to the emdash schema table — the field's `widget` column takes the `plugin-id:widget-name` string. For the stock sqlite adapter that is:

```sql
UPDATE _emdash_fields
SET widget = 'featured-image-studio:picker'
WHERE slug = 'featured_image'
  AND collection_id = (SELECT id FROM _emdash_collections WHERE slug = 'posts');
```

On Cloudflare D1 the same statement runs via `wrangler d1 execute`. Remember to apply it to both your local dev DB and production.

## Features

- **Unsplash search** — paginated grid with orientation filter, per-photo attribution.
- **One-click import** — downloads the full-size image, uploads to the media library, pings Unsplash's tracking endpoint per their API guidelines, stores photographer attribution metadata.
- **Field widget** — replaces the default image picker on any image field the user opts in via schema.
- **Standalone admin page** — search and import outside of any post editing session.
- **Settings page** — BYOK key entry (via EmDash's auto-generated settings form) plus TOS / rate-limit notes.

## Capabilities

This plugin declares:

- `network:fetch` (restricted to `api.unsplash.com` + `images.unsplash.com`)

Image imports are sent through the authenticated EmDash admin media API (`/_emdash/api/media`); the plugin does not declare or use a separate `write:media` capability. No access to site content, users, or email.

## Known issue: CSP blocks Unsplash thumbnails

EmDash's admin Content-Security-Policy hardcodes `img-src` to `'self' data: blob:` (plus the marketplace origin) and does **not** extend it based on plugin `allowedHosts` — see [emdash-cms/emdash#415](https://github.com/emdash-cms/emdash/issues/415). Until that is fixed upstream, the Unsplash search tab will render empty tiles in the admin UI (titles and attribution show, but the image areas are blank) because `https://images.unsplash.com` is blocked by CSP.

**Workaround (Cloudflare Workers adapter):** wrap your worker entrypoint to patch the outbound CSP header on `/_emdash` responses. Patching from Astro user middleware (`src/middleware.ts`) does *not* work — EmDash's middleware runs outside user middleware in the chain and overwrites the header after user middleware returns.

```ts
// src/worker.ts
import handler from "@astrojs/cloudflare/entrypoints/server";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

const wrapped: ExportedHandler = {
  async fetch(request, env, ctx) {
    const response = await (handler as any).fetch(request, env, ctx);
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/_emdash")) return response;

    const csp = response.headers.get("Content-Security-Policy");
    if (!csp || csp.includes("images.unsplash.com")) return response;

    const patched = csp
      .replace(/img-src ([^;]*)/, "img-src $1 https://images.unsplash.com")
      .replace(/connect-src ([^;]*)/, "connect-src $1 https://api.unsplash.com");

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Content-Security-Policy", patched);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};

export default wrapped;
```

You'll also need to point `wrangler.jsonc` at this file (`"main": "./src/worker.ts"`) if it isn't already.

## Roadmap

- **v0.2**: BYOK OpenAI Images + Replicate AI generation, Pexels + Openverse stock providers.
- **v0.3**: Auto-crop to responsive variants, AI-generated alt-text.

## License

MIT © Devon Hillard
