# emdash-plugins

A monorepo of plugins for [EmDash CMS](https://github.com/emdash-cms/emdash) by [Devon Hillard](https://github.com/devondragon), published to npm under the [`@devondragon`](https://www.npmjs.com/~devondragon) scope.

## Packages

| Package | Version | Description |
| --- | --- | --- |
| [`@devondragon/emdash-plugin-404-viewer`](./packages/404-viewer) | [![npm](https://img.shields.io/npm/v/@devondragon/emdash-plugin-404-viewer.svg)](https://www.npmjs.com/package/@devondragon/emdash-plugin-404-viewer) | Admin UI for browsing, searching, and pruning the built-in `_emdash_404_log` table. |
| [`@devondragon/emdash-plugin-featured-image-studio`](./packages/featured-image-studio) | [![npm](https://img.shields.io/npm/v/@devondragon/emdash-plugin-featured-image-studio.svg)](https://www.npmjs.com/package/@devondragon/emdash-plugin-featured-image-studio) | Search Unsplash and import photos (with attribution) into your media library — as a standalone admin page or an in-editor field widget. |

More plugins coming — this repo is the home for everything EmDash-related I publish.

## Using a plugin

Install the package you want and register it with EmDash in your `astro.config.mjs`:

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

Each package has its own README with specifics — see the links in the table above.

## Developing

This is a [pnpm](https://pnpm.io/) workspace. Packages are built with [tsdown](https://tsdown.dev/) and versioned/published via [changesets](https://github.com/changesets/changesets).

```bash
pnpm install          # install all workspace deps
pnpm build            # build every package
pnpm typecheck        # tsc --noEmit across all packages

# Work on a single package
pnpm -F @devondragon/emdash-plugin-404-viewer build
pnpm -F @devondragon/emdash-plugin-404-viewer typecheck
```

### Repo layout

```
emdash-plugins/
├── packages/           # one directory per published plugin
├── .changeset/         # pending changesets (tracked in git)
├── .github/workflows/  # CI (typecheck + build) and release (changesets action)
└── docs/               # specs and plans
```

## Releasing

Releases are automated by the [changesets GitHub Action](https://github.com/changesets/action) on `main`:

1. Make your changes on a branch.
2. Run `pnpm changeset` to author a changeset (pick package, bump type, write a summary) and commit it.
3. Open a PR. CI runs typecheck + build.
4. On merge to `main`, the Release workflow opens a "Version Packages" PR that applies the changeset (bumps versions, updates CHANGELOGs).
5. Merging the Version Packages PR publishes to npm via OIDC trusted publishing — no tokens required.

## Contributing

Issues and PRs welcome. If you want to propose a new plugin, open an issue first so we can talk through scope before you build it.

## License

[MIT](./LICENSE) © Devon Hillard
