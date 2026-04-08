# EmDash Plugins Monorepo Migration

**Date**: 2026-04-08
**Owner**: Devon Hillard
**Status**: Approved design — ready for implementation

## Context

The `404-viewer` plugin currently lives at `digitalsanctuary/plugins/404-viewer/` as a local pnpm workspace package (`@digitalsanctuary/plugin-404-viewer`). It works, but it's coupled to the personal site repo, can't be installed by other EmDash users, and has no path to publication.

This spec covers extracting it into a new public monorepo (`devondragon/emdash-plugins`), publishing it as `@devondragon/emdash-plugin-404-viewer`, and cutting the digitalsanctuary site over to consume the published npm package. The monorepo is sized to host additional plugins as they're built — `404-viewer` is the first, not the only.

A Block Kit / sandboxed-marketplace rewrite was considered and rejected: the plugin reads EmDash's built-in `_emdash_404_log` table, and the sandbox `PluginContext` (`node_modules/emdash/src/plugins/context.ts:804`) does not expose any capability to read that table. Until EmDash adds such a capability, this plugin must remain a trusted/native plugin published via npm.

## Decisions locked

| Decision | Choice | Rationale |
|---|---|---|
| Repo strategy | Monorepo (`devondragon/emdash-plugins`) | Amortizes setup across future plugins; consumers still install single packages from npm. |
| npm scope | `@devondragon` | Matches GitHub identity; separates OSS work from `@digitalsanctuary` site brand. |
| Package name | `@devondragon/emdash-plugin-404-viewer` | `emdash-plugin-` prefix matches `@astrojs/`/`eslint-plugin-*` discoverability convention. |
| Site consumption | Pull from npm only (no workspace link) | Validates the published package end-to-end; treats own plugin like any third-party dep. |
| License | MIT | Standard ecosystem default. |
| Initial version | `0.1.0` | Signals early-but-usable. |
| Build tool | `tsdown` | Matches `@emdash-cms/plugin-*` packages; ESM-first; bundled output. |
| Release tooling | `changesets` | De facto pnpm-monorepo standard for per-package versioning. |
| CI provider | GitHub Actions | Matches existing workflows. |

## Repo layout

```
emdash-plugins/
├── .github/workflows/
│   ├── ci.yml              # typecheck + build on PRs
│   └── release.yml         # changesets → npm publish on merge to main
├── .changeset/
│   └── config.json
├── packages/
│   └── 404-viewer/
│       ├── src/
│       │   ├── index.ts    # createPlugin entrypoint
│       │   └── admin.tsx   # React admin UI (unchanged from current)
│       ├── package.json
│       ├── tsconfig.json
│       ├── README.md
│       └── LICENSE
├── package.json            # workspace root, devDeps only (changesets, typescript, tsdown)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .npmrc                  # auto-install-peers=true
├── README.md               # explains the collection, lists packages
└── LICENSE                 # MIT, repo-level
```

Adding plugin #2 later is `mkdir packages/<name>` plus a changeset entry — no restructure.

## Package shape

### `packages/404-viewer/package.json`

```jsonc
{
  "name": "@devondragon/emdash-plugin-404-viewer",
  "version": "0.1.0",
  "description": "EmDash admin plugin: viewer for the built-in 404 log table",
  "license": "MIT",
  "author": "Devon Hillard <devon@devondragon.com>",
  "homepage": "https://github.com/devondragon/emdash-plugins/tree/main/packages/404-viewer#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/devondragon/emdash-plugins.git",
    "directory": "packages/404-viewer"
  },
  "bugs": "https://github.com/devondragon/emdash-plugins/issues",
  "keywords": ["emdash", "emdash-plugin", "cms", "404", "admin"],
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./admin": {
      "types": "./dist/admin.d.ts",
      "import": "./dist/admin.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "emdash": "^0.1.0",
    "react": "^19.0.0",
    "@cloudflare/kumo": "^1.0.0",
    "@phosphor-icons/react": "^2.1.10"
  },
  "devDependencies": {
    "@cloudflare/kumo": "^1.17.0",
    "@phosphor-icons/react": "^2.1.10",
    "@types/react": "^19.2.14",
    "emdash": "^0.1.0",
    "react": "^19.2.4",
    "tsdown": "^0.7.0",
    "typescript": "^5.9.3"
  }
}
```

**Dependency rationale**:
- The current `plugins/404-viewer/package.json` already declares `emdash`, `react`, `@cloudflare/kumo`, and `@phosphor-icons/react` as peer deps (no regular deps). This confirms the right strategy: **all four stay as peer deps** so consumers don't get duplicate React contexts or duplicate Kumo instances.
- The same packages are also listed under `devDependencies` to satisfy the build/typecheck inside the monorepo.
- Versions resolved from `digitalsanctuary/pnpm-lock.yaml` at `2026-04-08`.

### Two entrypoints

The current plugin exposes two exports — both must be preserved in the published package:

| Export | Source | Purpose |
|---|---|---|
| `.` | `src/index.ts` | Plugin descriptor (`notFoundViewerPlugin`) consumed by `astro.config.mjs` |
| `./admin` | `src/admin.tsx` | React admin UI — loaded by EmDash via the `adminEntry` field on the descriptor |

The descriptor (`notFoundViewerPlugin`) hardcodes the admin entrypoint string. Currently `src/index.ts:8-9` references `@digitalsanctuary/plugin-404-viewer` and `@digitalsanctuary/plugin-404-viewer/admin`. Both strings must be rewritten to `@devondragon/emdash-plugin-404-viewer` and `@devondragon/emdash-plugin-404-viewer/admin` during the port.

`src/index.ts` keeps both exports it has today:

```ts
export function notFoundViewerPlugin(): PluginDescriptor { /* ... */ }
export function createPlugin(): ResolvedPlugin { /* ... */ }
export default createPlugin;
```

The descriptor function (`notFoundViewerPlugin`) is the one site authors call from `astro.config.mjs`. The `createPlugin`/default export is the runtime plugin factory used inside EmDash.

Consumer usage:

```ts
import { notFoundViewerPlugin } from "@devondragon/emdash-plugin-404-viewer";

export default defineConfig({
  integrations: [
    emdash({ plugins: [notFoundViewerPlugin()] }),
  ],
});
```

## Migration phases

### Phase 1 — New repo bootstrap
1. `gh repo create devondragon/emdash-plugins --public` (or via web UI).
2. Clone as a sibling to `digitalsanctuary/`.
3. Scaffold: `pnpm init`, `pnpm-workspace.yaml`, `tsconfig.base.json`, root `.gitignore`, root `LICENSE` (MIT), root `README.md`, `.npmrc` with `auto-install-peers=true`.
4. Install root devDeps: `typescript`, `@changesets/cli`, `tsdown`.
5. `pnpm changeset init`; configure `.changeset/config.json` for public packages, base branch `main`.

### Phase 2 — Port the plugin
6. Copy `digitalsanctuary/plugins/404-viewer/src/` → `emdash-plugins/packages/404-viewer/src/`. (No tsconfig.json exists in the current plugin — must be authored fresh.)
7. Author the new `package.json` per shape above (the current one has no build, no devDeps, no dist — full rewrite, not edit).
8. Author `packages/404-viewer/tsconfig.json` extending `tsconfig.base.json`, with `jsx: "react-jsx"` for the .tsx admin file.
9. Rewrite the hardcoded package name strings inside `src/index.ts` lines 8 and 9: `@digitalsanctuary/plugin-404-viewer` → `@devondragon/emdash-plugin-404-viewer` (both `entrypoint` and `adminEntry`).
10. Author `packages/404-viewer/README.md`: install, usage, EmDash version requirement, D1 backend note, link to issues.
11. Add per-package `LICENSE` (MIT — npm displays the per-package one in the package listing).
12. `pnpm install` from repo root, `pnpm -F @devondragon/emdash-plugin-404-viewer build`. Verify `dist/` contains both `index.js` and `admin.js` plus type defs.
13. `pnpm pack` and inspect the tarball. Confirm only `dist/`, `README.md`, `LICENSE`, `package.json` ship.

### Phase 3 — CI
14. Add `.github/workflows/ci.yml`: pnpm install (frozen lockfile), `pnpm -r typecheck`, `pnpm -r build`.
15. Add `.github/workflows/release.yml`: `changesets/action`. Opens "Version Packages" PR on changeset commits to main; publishes to npm when that PR merges.

### Phase 4 — First publish
16. **[manual]** Verify or create `@devondragon` npm scope (`npm login`, then `npm org create devondragon` if needed). 2FA required.
17. **[manual]** Generate npm "Automation" token scoped to `@devondragon/*` via npmjs.com → Access Tokens.
18. **[manual or assisted]** Add token as GitHub Actions secret: `gh secret set NPM_TOKEN` (with token paste) or via GitHub UI.
19. `pnpm changeset` to author the first release entry: `@devondragon/emdash-plugin-404-viewer` → minor → "Initial public release".
20. `pnpm changeset version` to apply bumps locally; commit resulting `CHANGELOG.md` + `package.json` updates.
21. **[manual, eyes on terminal]** First publish: `pnpm -F @devondragon/emdash-plugin-404-viewer publish`. Validates the full pipeline before automation takes over. From release #2, the changesets bot handles publishes on merge.

### Phase 5 — Site repo cutover (digitalsanctuary)
22. `pnpm add @devondragon/emdash-plugin-404-viewer` in the site repo.
23. Update `astro.config.mjs` import: `@digitalsanctuary/plugin-404-viewer` → `@devondragon/emdash-plugin-404-viewer`. The function name (`notFoundViewerPlugin`) stays the same.
24. Delete `plugins/404-viewer/` directory.
25. Remove the `workspace:*` entry from site `package.json`.
26. Delete `pnpm-workspace.yaml` entirely — confirmed it lists only `plugins/*` and 404-viewer is the only workspace package.
27. `./node_modules/.bin/emdash dev`, navigate to admin → 404 viewer page, confirm visual + behavioral parity.
28. `pnpm deploy:prd`.
29. Update `CLAUDE.md` to reflect that 404-viewer is now an external dep (the "Custom Admin Plugins" section needs to lose the 404-viewer example or rewrite it).

Phases 1–4 are net-new repo work. Phase 5 is the site cutover. **Split into two PR trains** so the site cutover is reviewed independently of repo bootstrap.

## Verification

End-to-end success criteria:

1. **Package on npm**: `npm view @devondragon/emdash-plugin-404-viewer` returns metadata. Tarball contains exactly `dist/`, `README.md`, `LICENSE`, `package.json` — no source, no `node_modules`, no `.tsbuildinfo`.
2. **Fresh-install smoke test**: in a clean directory, `pnpm init && pnpm add @devondragon/emdash-plugin-404-viewer emdash react` succeeds; `node_modules/@devondragon/emdash-plugin-404-viewer/dist/index.js` exists; a one-liner Node script can `import` the entrypoint without runtime errors.
3. **Site cutover works**: digitalsanctuary builds, admin loads, 404 viewer page renders identically to before, tabs / search / clear / prune all function against the existing `_emdash_404_log` table.
4. **Production deploy**: `pnpm deploy:prd` succeeds; live admin at `https://www.digitalsanctuary.com/_emdash/admin` shows the same plugin behavior.
5. **No leftovers**: `grep -r "@digitalsanctuary/plugin-404-viewer" .` in the site repo returns nothing; `plugins/404-viewer/` directory does not exist.
6. **CI green**: a no-op PR to `emdash-plugins` runs `ci.yml` successfully; merging a real changeset opens a "Version Packages" PR; merging that PR publishes to npm.

All six must pass before declaring migration complete.

## Out of scope

- Block Kit / sandboxed marketplace publishing (blocked on upstream EmDash sandbox capabilities).
- Themes (no EmDash theme system exists).
- Additional plugins beyond `404-viewer` — those will be authored as separate brainstorm → spec → plan cycles.
- Backporting tests for the 404-viewer plugin — currently has none; adding test infra is its own task.
- Migrating other `@emdash-cms/*` style plugins.

## Open questions

All open questions resolved during the writing-plans phase by reading the actual source:

- ✅ Resolved versions captured in the `package.json` shape above (kumo 1.17.0, phosphor 2.1.10, react 19.2.4, typescript 5.9.3, @types/react 19.2.14, tsdown ^0.7.0).
- ✅ `@cloudflare/kumo` and `@phosphor-icons/react` are already declared as peer deps in the current plugin — confirmed they should remain peers.
- ✅ `pnpm-workspace.yaml` in the site repo can be deleted entirely after Phase 5 — verified it lists only `plugins/*` and 404-viewer is the only entry.

## Spec self-review notes

- No placeholders in the design.
- No internal contradictions found after corrections from source-reading during writing-plans phase.
- Scope is one focused migration, not a multi-feature roadmap.
- Migration is split into two PR trains (new repo + site cutover) rather than one combined change.

## Revision history

- **2026-04-08 v1**: Initial design, brainstorming approval.
- **2026-04-08 v2** (during writing-plans): Corrections from reading current plugin source — added second `./admin` export, changed kumo/phosphor from regular to peer deps, removed phantom `tsconfig.json` copy, documented hardcoded package-name strings to rewrite in `src/index.ts`, confirmed `pnpm-workspace.yaml` deletion, fixed consumer example to use `notFoundViewerPlugin` not `createPlugin`.
