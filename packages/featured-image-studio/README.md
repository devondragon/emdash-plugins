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

1. Open **Plugins → Featured Image Studio → Settings** in the EmDash admin and paste your Unsplash Access Key.
2. Visit **Plugins → Featured Image Studio → Image Studio** to search and import images directly into the media library.
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
- `write:media`

No access to site content, users, or email.

## Roadmap

- **v0.2**: BYOK OpenAI Images + Replicate AI generation, Pexels + Openverse stock providers.
- **v0.3**: Auto-crop to responsive variants, AI-generated alt-text.

## License

MIT © Devon Hillard
