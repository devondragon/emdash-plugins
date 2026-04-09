# @devondragon/emdash-plugin-featured-image-studio

## 0.2.0

### Minor Changes

- e065f6a: Initial release of `featured-image-studio` (v0.1).

  - Unified stock + AI picker — v0.1 ships with Unsplash stock search functional and an AI Generation tab scaffolded for v0.2 (OpenAI Images / Replicate BYOK).
  - Backend routes under `/_emdash/api/plugins/featured-image-studio/`: `unsplash/search`, `unsplash/fetch-bytes`, `unsplash/save-attribution`, `unsplash/test-key`, plus key-management routes (`unsplash/key-status`, `unsplash/save-key`, `unsplash/clear-key`). Uses `ctx.http.fetch` host-restricted to `api.unsplash.com` + `images.unsplash.com`.
  - Import flow: the plugin backend downloads full-res bytes from Unsplash and returns them to the browser, which then POSTs to the host's authenticated media API (`/_emdash/api/media`) under the current admin session — plugin contexts don't have direct media-pipeline access in emdash v0.1.0. Attribution metadata is persisted via a follow-up plugin route.
  - One admin page (`Image Studio`) rendering the picker inline with tabs for Media Library, Stock (Unsplash), AI Generation, and Settings. The Unsplash Access Key is managed from the Settings tab (stored via the plugin's key routes); the tab is hidden in the field-widget modal.
  - Field widget `featured-image-studio:picker` for image/media fields — users attach it in their collection schema to get a "Browse / Generate" button on any featured-image field.
  - Persists photographer attribution metadata alongside each imported media id so v0.2 themes can render credit automatically. Pings Unsplash's download-tracking endpoint on every actual import per their API guidelines.
  - Capabilities: `network:fetch` (host-restricted). Media uploads go through the authenticated admin media API, not a plugin capability.
