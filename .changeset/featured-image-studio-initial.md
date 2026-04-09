---
"@devondragon/emdash-plugin-featured-image-studio": minor
---

Initial release of `featured-image-studio` (v0.1).

- Unified stock + AI picker modal — v0.1 ships with Unsplash stock search functional and an AI Generation tab scaffolded for v0.2 (OpenAI Images / Replicate BYOK).
- Backend routes under `/_emdash/api/plugins/featured-image-studio/`: `unsplash/search`, `unsplash/import`, `unsplash/test-key`. Uses `ctx.http.fetch` (host-restricted to api.unsplash.com + images.unsplash.com) and `ctx.media.upload` to deliver imported bytes directly to the media library.
- Two admin pages: a Studio page that renders the picker inline and a Settings page with TOS / rate-limit notes and a "test key" helper. The Unsplash Access Key is stored as a secret via the plugin's `admin.settingsSchema` (auto-generated form).
- Field widget `featured-image-studio:picker` for image/media fields — users attach it in their collection schema to get a "Browse / Generate" button on any featured-image field.
- Persists photographer attribution metadata alongside each imported media id (KV `state:attribution:*`) so v0.2 themes can render credit automatically. Pings Unsplash's download-tracking endpoint on every actual import per their API guidelines.
- Capabilities: `network:fetch`, `write:media`.
