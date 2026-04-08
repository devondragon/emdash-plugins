# @devondragon/emdash-plugin-404-viewer

EmDash admin plugin that surfaces the built-in `_emdash_404_log` table as a viewer in the EmDash admin sidebar. See aggregate hit counts, browse the full log with search and pagination, and prune or clear entries.

## Requirements

- EmDash `^0.1.0`
- React `^19`
- An EmDash site backed by Cloudflare D1 (the plugin reads `_emdash_404_log`, which is populated by EmDash's redirect middleware)

## Installation

```bash
pnpm add @devondragon/emdash-plugin-404-viewer
```

## Usage

In your `astro.config.mjs`:

```ts
import { defineConfig } from "astro/config";
import emdash from "emdash";
import { notFoundViewerPlugin } from "@devondragon/emdash-plugin-404-viewer";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [notFoundViewerPlugin()],
    }),
  ],
});
```

After running your dev server, the "404 Log" page appears in the EmDash admin sidebar.

## Features

- **Summary view** — paths grouped by hit count, with severity badges and "last seen" timestamps.
- **Full log view** — paginated browsing with search-by-path.
- **Prune older than N days** — bulk delete with a date threshold.
- **Clear all** — wipes the entire log (confirms first).

## Notes

- The plugin reads from EmDash's built-in API (`/_emdash/api/redirects/404s`) — no separate database setup required.
- Uses `@cloudflare/kumo` and `@phosphor-icons/react` (already required by EmDash) for UI primitives.

## License

MIT © Devon Hillard
