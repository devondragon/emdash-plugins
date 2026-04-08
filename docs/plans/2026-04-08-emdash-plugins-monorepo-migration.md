# EmDash Plugins Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the `404-viewer` plugin from the digitalsanctuary site repo into a new public monorepo (`devondragon/emdash-plugins`), publish it as `@devondragon/emdash-plugin-404-viewer` on npm, and cut the digitalsanctuary site over to consume the published package instead of the local workspace package.

**Architecture:** New pnpm monorepo at `~/git/digitalsanctuary-emdash/emdash-plugins/` (sibling to digitalsanctuary), built with `tsdown`, versioned via `changesets`, released via GitHub Actions on merge to main. Site repo cuts over in a separate PR after first publish succeeds.

**Tech Stack:** pnpm workspaces, changesets, tsdown, TypeScript 5.9, React 19, GitHub Actions, npm registry.

**Spec:** `docs/superpowers/specs/2026-04-08-emdash-plugins-monorepo-migration.md`

---

## Conventions

- All paths in **Phase 1–4** are relative to `~/git/digitalsanctuary-emdash/emdash-plugins/` (the new repo).
- All paths in **Phase 5** are relative to `~/git/digitalsanctuary-emdash/digitalsanctuary/` (the site repo).
- Steps marked **[manual]** require human action (npm credentials, 2FA, eyes-on-terminal publish).
- After each task, verify the listed expected output before committing. If verification fails, stop and diagnose — do not auto-retry.

---

# Phase 1 — New repo bootstrap

## Task 1: Create the GitHub repo and clone locally

**Files:** none yet — repo creation.

- [ ] **Step 1: Create the repo on GitHub**

```bash
cd ~/git/digitalsanctuary-emdash
gh repo create devondragon/emdash-plugins \
  --public \
  --description "Open-source EmDash CMS plugins by Devon Hillard" \
  --license MIT \
  --clone
```

Expected output: `✓ Created repository devondragon/emdash-plugins on GitHub` followed by `✓ Cloned repository`. A new directory `emdash-plugins/` should exist as a sibling of `digitalsanctuary/`.

- [ ] **Step 2: Verify clone**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
ls -la
git remote -v
```

Expected: `LICENSE`, `README.md`, `.git/` present. Remote `origin` points to `git@github.com:devondragon/emdash-plugins.git`.

- [ ] **Step 3: No commit yet — repo has the GitHub-generated initial commit only.**

---

## Task 2: Initialize the workspace root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`

- [ ] **Step 1: Author root `package.json`**

Write `~/git/digitalsanctuary-emdash/emdash-plugins/package.json`:

```jsonc
{
  "name": "emdash-plugins",
  "version": "0.0.0",
  "private": true,
  "description": "Monorepo for EmDash CMS plugins by Devon Hillard",
  "license": "MIT",
  "author": "Devon Hillard <devon@devondragon.com>",
  "homepage": "https://github.com/devondragon/emdash-plugins",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/devondragon/emdash-plugins.git"
  },
  "scripts": {
    "build": "pnpm -r --filter \"./packages/*\" build",
    "typecheck": "pnpm -r --filter \"./packages/*\" typecheck",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.10",
    "tsdown": "^0.7.0",
    "typescript": "^5.9.3"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: Author `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Author `.npmrc`**

```
auto-install-peers=true
```

- [ ] **Step 4: Author `.gitignore`** (overwrite the GitHub default)

```
node_modules
dist
.tsbuildinfo
*.tsbuildinfo
.DS_Store
*.tgz
```

Note: changeset markdown files under `.changeset/` MUST be committed — they're how changesets tracks pending releases. Don't add them to `.gitignore`.

- [ ] **Step 5: Verify**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
ls -la package.json pnpm-workspace.yaml .npmrc .gitignore
```

Expected: all four files present.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc .gitignore
git commit -m "chore: scaffold pnpm workspace root"
```

---

## Task 3: Install root dev dependencies

**Files:**
- Create: `pnpm-lock.yaml` (generated)

- [ ] **Step 1: Install**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
pnpm install
```

Expected: pnpm fetches `@changesets/cli`, `tsdown`, `typescript` into root `node_modules`. No errors. `pnpm-lock.yaml` created.

- [ ] **Step 2: Verify**

```bash
ls node_modules/.bin/ | grep -E "changeset|tsdown|tsc"
```

Expected: `changeset`, `tsdown`, `tsc` all present.

- [ ] **Step 3: Commit**

```bash
git add pnpm-lock.yaml
git commit -m "chore: install root devDependencies"
```

---

## Task 4: Author root `tsconfig.base.json`

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: Write the file**

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

- [ ] **Step 2: Verify**

```bash
node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json', 'utf8'))" && echo OK
```

Expected: `OK`. (TypeScript treats this as JSONC and tolerates comments, but the file as written has none.)

- [ ] **Step 3: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add base tsconfig"
```

---

## Task 5: Initialize changesets

**Files:**
- Create: `.changeset/config.json`
- Create: `.changeset/README.md` (auto-generated by `changeset init`)

- [ ] **Step 1: Run init**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
pnpm changeset init
```

Expected: creates `.changeset/config.json` and `.changeset/README.md`.

- [ ] **Step 2: Edit `.changeset/config.json` to enable public package publishing**

Replace contents with:

```jsonc
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

The critical change is `"access": "public"` (default is `"restricted"` which would fail to publish scoped packages).

- [ ] **Step 3: Verify**

```bash
node -e "console.log(require('./.changeset/config.json').access)"
```

Expected: `public`

- [ ] **Step 4: Commit**

```bash
git add .changeset/
git commit -m "chore: initialize changesets with public access"
```

---

## Task 6: Push Phase 1 to remote

- [ ] **Step 1: Push**

```bash
git push origin main
```

Expected: branch updates, no errors.

- [ ] **Step 2: Verify on GitHub**

```bash
gh repo view devondragon/emdash-plugins --web
```

Expected: the new repo opens in browser showing the scaffold commits.

---

# Phase 2 — Port the plugin

## Task 7: Create the package directory and copy source

**Files:**
- Create: `packages/404-viewer/src/index.ts`
- Create: `packages/404-viewer/src/admin.tsx`

- [ ] **Step 1: Create directories and copy source files**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
mkdir -p packages/404-viewer/src
cp ~/git/digitalsanctuary-emdash/digitalsanctuary/plugins/404-viewer/src/index.ts packages/404-viewer/src/index.ts
cp ~/git/digitalsanctuary-emdash/digitalsanctuary/plugins/404-viewer/src/admin.tsx packages/404-viewer/src/admin.tsx
```

- [ ] **Step 2: Verify file sizes match**

```bash
wc -l packages/404-viewer/src/*.ts packages/404-viewer/src/*.tsx
```

Expected: `index.ts` ~30 lines, `admin.tsx` ~460 lines.

- [ ] **Step 3: No commit yet — these files reference the old package name and will be edited next.**

---

## Task 8: Rewrite hardcoded package name in `src/index.ts`

**Files:**
- Modify: `packages/404-viewer/src/index.ts`

- [ ] **Step 1: Read the current file**

```bash
cat packages/404-viewer/src/index.ts
```

Confirm lines 8 and 9 contain `@digitalsanctuary/plugin-404-viewer`.

- [ ] **Step 2: Replace both occurrences**

Edit `packages/404-viewer/src/index.ts`:
- Line 8: `entrypoint: "@digitalsanctuary/plugin-404-viewer"` → `entrypoint: "@devondragon/emdash-plugin-404-viewer"`
- Line 9: `adminEntry: "@digitalsanctuary/plugin-404-viewer/admin"` → `adminEntry: "@devondragon/emdash-plugin-404-viewer/admin"`

- [ ] **Step 3: Verify both strings replaced**

```bash
grep -n "digitalsanctuary" packages/404-viewer/src/index.ts && echo "FAIL: still references old name" || echo "OK"
grep -n "devondragon/emdash-plugin-404-viewer" packages/404-viewer/src/index.ts
```

Expected: `OK` (no matches for `digitalsanctuary`), and two matches for the new name.

- [ ] **Step 4: No commit yet — package.json comes next.**

---

## Task 9: Author `packages/404-viewer/package.json`

**Files:**
- Create: `packages/404-viewer/package.json`

- [ ] **Step 1: Write the file**

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

- [ ] **Step 2: Verify it's valid JSON and has the right name**

```bash
node -e "const p = require('./packages/404-viewer/package.json'); console.log(p.name, p.version)"
```

Expected: `@devondragon/emdash-plugin-404-viewer 0.1.0`

- [ ] **Step 3: No commit yet.**

---

## Task 10: Author `packages/404-viewer/tsconfig.json`

**Files:**
- Create: `packages/404-viewer/tsconfig.json`

- [ ] **Step 1: Write the file**

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 2: Verify**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/404-viewer/tsconfig.json', 'utf8'))" && echo OK
```

Expected: `OK`

---

## Task 11: Author `packages/404-viewer/tsdown.config.ts`

**Files:**
- Create: `packages/404-viewer/tsdown.config.ts`

tsdown needs an explicit config to tell it about the two entrypoints (`.` and `./admin`).

- [ ] **Step 1: Write the config**

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    admin: "src/admin.tsx",
  },
  format: "esm",
  dts: true,
  clean: true,
  external: [
    "emdash",
    "react",
    "react/jsx-runtime",
    "@cloudflare/kumo",
    "@phosphor-icons/react",
  ],
});
```

The `external` list ensures peer deps aren't bundled into `dist/`.

- [ ] **Step 2: Verify**

```bash
ls packages/404-viewer/tsdown.config.ts
```

Expected: file exists.

---

## Task 12: Author `packages/404-viewer/README.md`

**Files:**
- Create: `packages/404-viewer/README.md`

- [ ] **Step 1: Write the README**

```markdown
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
```

- [ ] **Step 2: Verify**

```bash
wc -l packages/404-viewer/README.md
```

Expected: ~50 lines.

---

## Task 13: Add per-package LICENSE

**Files:**
- Create: `packages/404-viewer/LICENSE`

- [ ] **Step 1: Copy the root LICENSE**

```bash
cp LICENSE packages/404-viewer/LICENSE
```

- [ ] **Step 2: Verify it's MIT and has the right copyright year**

```bash
head -3 packages/404-viewer/LICENSE
```

Expected: starts with `MIT License` and shows the current year. If `gh repo create --license MIT` generated it with a placeholder name, update it to `Copyright (c) 2026 Devon Hillard`.

---

## Task 14: Install dependencies and build

**Files:**
- Modify: `pnpm-lock.yaml`
- Create: `packages/404-viewer/dist/`

- [ ] **Step 1: Install (picks up the new package)**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
pnpm install
```

Expected: pnpm resolves the new package, installs `@cloudflare/kumo`, `@phosphor-icons/react`, `@types/react`, `emdash`, `react` into the package's local `node_modules`. No errors.

- [ ] **Step 2: Build the package**

```bash
pnpm -F @devondragon/emdash-plugin-404-viewer build
```

Expected: tsdown emits to `packages/404-viewer/dist/`. No errors.

- [ ] **Step 3: Verify dist contents**

```bash
ls packages/404-viewer/dist/
```

Expected files: `index.js`, `index.d.ts`, `admin.js`, `admin.d.ts` (and possibly `.js.map` / `.d.ts.map`). No source files, no `node_modules`.

- [ ] **Step 4: Spot-check that peer deps were not bundled**

```bash
grep -l "@cloudflare/kumo" packages/404-viewer/dist/admin.js && echo "OK: kumo is referenced (as import, not bundled)"
grep -c "createElement" packages/404-viewer/dist/admin.js
```

Expected: kumo is `import`-referenced (a few lines), not inlined as a 50KB blob. createElement count should be modest (single-digit usages from the plugin's own JSX), not thousands (which would indicate React was bundled).

---

## Task 15: Inspect the publish tarball

- [ ] **Step 1: Pack**

```bash
cd packages/404-viewer
pnpm pack
```

Expected: produces `devondragon-emdash-plugin-404-viewer-0.1.0.tgz` in the package directory.

- [ ] **Step 2: List tarball contents**

```bash
tar -tzf devondragon-emdash-plugin-404-viewer-0.1.0.tgz | sort
```

Expected output (exactly these, with the `package/` prefix tar adds):

```
package/LICENSE
package/README.md
package/dist/admin.d.ts
package/dist/admin.js
package/dist/index.d.ts
package/dist/index.js
package/package.json
```

If any source files (`.ts`, `.tsx`), `node_modules`, `.tsbuildinfo`, or stray files appear: stop and fix the `files` field in `package.json`.

- [ ] **Step 3: Cleanup**

```bash
rm devondragon-emdash-plugin-404-viewer-0.1.0.tgz
cd ~/git/digitalsanctuary-emdash/emdash-plugins
```

- [ ] **Step 4: Commit Phase 2**

```bash
git add packages/404-viewer pnpm-lock.yaml
git commit -m "feat: port 404-viewer plugin to monorepo

- Copy src/ from digitalsanctuary/plugins/404-viewer
- Rewrite hardcoded package name strings to @devondragon/emdash-plugin-404-viewer
- Author package.json with peer-dep declarations and tsdown build
- Add tsconfig, tsdown.config, README, LICENSE
- Verified clean dist/ and tarball contents"
```

---

# Phase 3 — CI

## Task 16: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm typecheck

      - run: pnpm build
```

- [ ] **Step 3: Verify YAML is valid**

```bash
node -e "require('js-yaml')" 2>/dev/null || npm ls js-yaml 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
```

Expected: `OK` (or no error from the python check).

---

## Task 17: Add release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write `release.yml`**

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm run version-packages
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Commit Phase 3**

```bash
git add .github/workflows/
git commit -m "ci: add CI and release workflows

- ci.yml runs typecheck + build on PRs and pushes to main
- release.yml uses changesets/action to open Version Packages PRs and publish on merge"
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: push succeeds, GitHub Actions runs `ci.yml`. Check the run with `gh run watch` and confirm it passes before continuing.

---

# Phase 4 — First publish

## Task 18: Verify or create the npm scope

- [ ] **Step 1: [manual] Check whether `@devondragon` already exists on npm**

```bash
npm view @devondragon
```

Expected: either returns scope metadata (already exists, skip Step 2) or `404 Not Found`.

- [ ] **Step 2: [manual] If the scope doesn't exist, create it**

```bash
npm login
# Enter username/password/2FA
npm org create devondragon
```

Expected: scope created. If `npm org create` fails with "already exists" or permission errors, create it via the npmjs.com web UI instead (Profile → Create Org → free org named `devondragon`).

- [ ] **Step 3: Verify you can publish to it**

```bash
npm whoami
npm access list packages @devondragon
```

Expected: your username is shown; the package list is empty or shows existing packages you own.

---

## Task 19: Generate the npm automation token

- [ ] **Step 1: [manual] Open npmjs.com → Profile → Access Tokens → Generate New Token → Granular**

Settings:
- Token name: `emdash-plugins-ci`
- Expiration: 1 year
- Permissions: `Read and write` packages
- Packages and scopes: `@devondragon/*`

- [ ] **Step 2: Copy the token (starts with `npm_...`)**

Save it somewhere safe — npm only shows it once.

- [ ] **Step 3: [manual or assisted] Add it as a GitHub Actions secret**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
gh secret set NPM_TOKEN
# Paste the token when prompted
```

Or via `gh repo view --web` → Settings → Secrets and variables → Actions → New repository secret.

- [ ] **Step 4: Verify the secret exists**

```bash
gh secret list
```

Expected: `NPM_TOKEN` is listed with a recent `Updated` timestamp.

---

## Task 20: Author the first changeset

**Files:**
- Create: `.changeset/<auto-named>.md`

- [ ] **Step 1: Run the changeset CLI**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
pnpm changeset
```

Interactive prompts:
- Which packages would you like to include? → `@devondragon/emdash-plugin-404-viewer`
- Which packages should have a major bump? → none
- Which packages should have a minor bump? → `@devondragon/emdash-plugin-404-viewer`
- Summary: `Initial public release of the 404 log viewer plugin`

Expected: a new file `.changeset/<adjective-noun-verb>.md` is created.

- [ ] **Step 2: Verify the changeset content**

```bash
cat .changeset/*.md | grep -v "^$"
```

Expected output includes `"@devondragon/emdash-plugin-404-viewer": minor` and the summary.

- [ ] **Step 3: Commit**

```bash
git add .changeset/
git commit -m "chore: add changeset for initial 404-viewer release"
```

---

## Task 21: Apply the version bump locally

This step is normally done by the GitHub Actions bot via the "Version Packages" PR, but for the **first** publish we do it manually so we can validate the whole pipeline before automation kicks in.

- [ ] **Step 1: Apply the changeset**

```bash
pnpm changeset version
```

Expected:
- `.changeset/<adjective-noun-verb>.md` is deleted
- `packages/404-viewer/package.json` version is unchanged (still `0.1.0` since this is the initial version)
- `packages/404-viewer/CHANGELOG.md` is created with the changeset entry

- [ ] **Step 2: Verify**

```bash
cat packages/404-viewer/CHANGELOG.md
ls .changeset/
```

Expected: CHANGELOG has a `## 0.1.0` entry; `.changeset/` contains only `README.md` and `config.json` (no leftover changeset files).

- [ ] **Step 3: Commit**

```bash
git add packages/404-viewer/CHANGELOG.md packages/404-viewer/package.json .changeset/
git commit -m "chore: version @devondragon/emdash-plugin-404-viewer@0.1.0"
git push origin main
```

---

## Task 22: First manual publish

**Files:** none modified — registry mutation only.

- [ ] **Step 1: Make sure you're logged in to npm**

```bash
npm whoami
```

Expected: your npm username. If empty or errors: `npm login`.

- [ ] **Step 2: [manual, eyes on terminal] Publish**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
pnpm -F @devondragon/emdash-plugin-404-viewer publish --no-git-checks
```

Expected output ends with `+ @devondragon/emdash-plugin-404-viewer@0.1.0`. The `--no-git-checks` flag prevents pnpm from refusing to publish if there are uncommitted local files (there shouldn't be, but the flag is harmless).

If it asks for an OTP, enter your 2FA code.

- [ ] **Step 3: Verify on npm**

```bash
npm view @devondragon/emdash-plugin-404-viewer
```

Expected: registry returns the package metadata, shows version `0.1.0`, license MIT, the dependency list, and the `tarball` URL.

- [ ] **Step 4: Smoke-test fresh install in a throwaway directory**

```bash
mkdir -p /tmp/emdash-plugin-smoke && cd /tmp/emdash-plugin-smoke
pnpm init
pnpm add @devondragon/emdash-plugin-404-viewer emdash react @cloudflare/kumo @phosphor-icons/react
ls node_modules/@devondragon/emdash-plugin-404-viewer/dist/
```

Expected: `index.js`, `index.d.ts`, `admin.js`, `admin.d.ts` present in `node_modules/.../dist/`.

- [ ] **Step 5: Cleanup smoke test**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
rm -rf /tmp/emdash-plugin-smoke
```

**Phase 4 complete. First publish succeeded. From here on, releases are automated by changesets bot.**

---

# Phase 5 — Site repo cutover (digitalsanctuary)

> ⚠️ **Switch repos.** From here, all paths are relative to `~/git/digitalsanctuary-emdash/digitalsanctuary/`.

> 📋 **Separate PR train.** Phase 5 should be a separate branch and a separate PR from Phases 1–4 so it's reviewable independently.

## Task 23: Create a feature branch

- [ ] **Step 1: Branch off**

```bash
cd ~/git/digitalsanctuary-emdash/digitalsanctuary
git checkout main
git pull
git checkout -b cutover-404-viewer-to-npm
```

---

## Task 24: Add the published package as a dependency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install from npm**

```bash
pnpm add @devondragon/emdash-plugin-404-viewer
```

Expected: new entry in `dependencies` of `package.json`. New entry in `pnpm-lock.yaml`.

- [ ] **Step 2: Verify it resolved to the published version (not workspace)**

```bash
grep "@devondragon/emdash-plugin-404-viewer" package.json
```

Expected: `"@devondragon/emdash-plugin-404-viewer": "^0.1.0"` (or similar — NOT `workspace:*`).

---

## Task 25: Update `astro.config.mjs` import

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Find the current import**

```bash
grep -n "@digitalsanctuary/plugin-404-viewer" astro.config.mjs
```

Expected: one match, around line 6.

- [ ] **Step 2: Edit the import**

Change:
```ts
import { notFoundViewerPlugin } from "@digitalsanctuary/plugin-404-viewer";
```
to:
```ts
import { notFoundViewerPlugin } from "@devondragon/emdash-plugin-404-viewer";
```

The function name `notFoundViewerPlugin` does not change.

- [ ] **Step 3: Verify**

```bash
grep -n "404-viewer" astro.config.mjs
```

Expected: the import line now shows `@devondragon/emdash-plugin-404-viewer`. The `plugins: [..., notFoundViewerPlugin()]` line is unchanged.

---

## Task 26: Remove the old workspace dep from `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Find the old entry**

```bash
grep -n "@digitalsanctuary/plugin-404-viewer" package.json
```

Expected: one entry in `dependencies` referencing `workspace:*`.

- [ ] **Step 2: Delete that line from `package.json`**

Remove the entire line `"@digitalsanctuary/plugin-404-viewer": "workspace:*",`.

- [ ] **Step 3: Verify**

```bash
grep "@digitalsanctuary/plugin-404-viewer" package.json && echo "FAIL: still present" || echo "OK"
```

Expected: `OK`.

---

## Task 27: Delete the local plugin directory

**Files:**
- Delete: `plugins/404-viewer/`

- [ ] **Step 1: Delete the directory**

```bash
rm -rf plugins/404-viewer
```

- [ ] **Step 2: Verify**

```bash
ls plugins/ 2>&1
```

Expected: either `ls: cannot access 'plugins/': No such file or directory` (whole `plugins/` dir is now empty) or an empty listing. If any other plugin directories remain, they stay.

- [ ] **Step 3: If `plugins/` is now empty, remove it**

```bash
rmdir plugins 2>/dev/null || true
```

---

## Task 28: Delete `pnpm-workspace.yaml`

**Files:**
- Delete: `pnpm-workspace.yaml`

This file currently lists only `plugins/*`. With the only workspace package gone, the file is no longer needed and removing it eliminates one source of confusion.

- [ ] **Step 1: Confirm content one last time**

```bash
cat pnpm-workspace.yaml
```

Expected: shows `packages:` with `- "plugins/*"` and possibly `onlyBuiltDependencies:` entries.

- [ ] **Step 2: Check if `onlyBuiltDependencies` matters**

If `pnpm-workspace.yaml` contains an `onlyBuiltDependencies:` block (it does — it lists `better-sqlite3`, `esbuild`, `sharp`, `workerd`), that block must be preserved by moving it elsewhere. pnpm reads `onlyBuiltDependencies` from `pnpm-workspace.yaml` OR `package.json` (under `pnpm.onlyBuiltDependencies`).

Move it to `package.json` under a new `pnpm` key:

```jsonc
{
  // ... existing fields ...
  "pnpm": {
    "onlyBuiltDependencies": [
      "better-sqlite3",
      "esbuild",
      "sharp",
      "workerd"
    ]
  }
}
```

- [ ] **Step 3: Now delete `pnpm-workspace.yaml`**

```bash
rm pnpm-workspace.yaml
```

- [ ] **Step 4: Verify**

```bash
ls pnpm-workspace.yaml 2>&1
grep -A6 '"pnpm"' package.json
```

Expected: `ls` errors with "No such file"; `package.json` shows the `pnpm.onlyBuiltDependencies` block.

---

## Task 29: Reinstall and validate

**Files:**
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Clean install**

```bash
rm -rf node_modules
pnpm install
```

Expected: succeeds, lockfile is updated to drop the old workspace package and include the new npm one. No errors. The `onlyBuiltDependencies` block should still be respected (no warnings about untrusted scripts).

- [ ] **Step 2: Verify the published package is in node_modules**

```bash
ls node_modules/@devondragon/emdash-plugin-404-viewer/dist/
```

Expected: `index.js`, `admin.js`, type defs.

- [ ] **Step 3: Verify the old package is NOT linked**

```bash
ls node_modules/@digitalsanctuary 2>&1
```

Expected: `No such file or directory`.

---

## Task 30: Smoke test in dev

- [ ] **Step 1: Start the dev server**

```bash
./node_modules/.bin/emdash dev
```

Expected: server starts without errors, runs migrations and seeds, generates types. No errors about missing plugin or unresolved imports.

- [ ] **Step 2: Open the admin and navigate to 404 Log**

In a browser, go to `http://localhost:4321/_emdash/admin` → log in → click "404 Log" in the sidebar.

Expected:
- Page renders identically to the previous native plugin.
- Tabs (Summary / Full Log) work.
- Search box (in Full Log view) works.
- Clear All button shows confirmation and works.
- Prune button works.
- All hit-count badges, time-ago strings, and table styling look unchanged.

- [ ] **Step 3: Stop the dev server (Ctrl+C)**

- [ ] **Step 4: If anything looks broken, stop and diagnose. Common issues:**
  - Missing dist file in node_modules → `pnpm install` again
  - Stale `.astro/` cache → `rm -rf .astro node_modules/.vite && pnpm install`
  - React duplicate (multiple React contexts) → check that `react` is hoisted and not duplicated under `node_modules/@devondragon/emdash-plugin-404-viewer/node_modules/`

---

## Task 31: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

The "Custom Admin Plugins (`plugins/`)" section currently uses 404-viewer as its example. Update it to either remove the section entirely (if no other native plugins remain) or replace the example with a placeholder note.

- [ ] **Step 1: Find the section**

```bash
grep -n "Custom Admin Plugins" CLAUDE.md
grep -n "404-viewer" CLAUDE.md
```

- [ ] **Step 2: Edit the section to remove the 404-viewer example**

Replace the **Example** line at the bottom of the "Custom Admin Plugins" section:

```markdown
**Example**: `plugins/404-viewer/` — admin viewer for `_emdash_404_log` entries using existing EmDash 404 API.
```

with:

```markdown
**Example**: This site's only native plugin (`404-viewer`) was extracted to its own published package — see `@devondragon/emdash-plugin-404-viewer` on npm. The notes above still apply if you ever add a new native plugin under `plugins/`.
```

- [ ] **Step 3: Verify**

```bash
grep -n "@devondragon/emdash-plugin-404-viewer" CLAUDE.md
```

Expected: one match in the updated section.

---

## Task 32: Commit Phase 5 changes

- [ ] **Step 1: Review the diff**

```bash
git status
git diff --stat
```

Expected modified/deleted files:
- modified: `astro.config.mjs`
- modified: `package.json`
- modified: `pnpm-lock.yaml`
- modified: `CLAUDE.md`
- deleted: `pnpm-workspace.yaml`
- deleted: `plugins/404-viewer/package.json`
- deleted: `plugins/404-viewer/src/index.ts`
- deleted: `plugins/404-viewer/src/admin.tsx`

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: consume 404-viewer plugin from npm

The 404-viewer plugin has been extracted to its own public monorepo
(devondragon/emdash-plugins) and published as
@devondragon/emdash-plugin-404-viewer on npm.

This commit:
- Adds the published package as a regular dependency
- Updates astro.config.mjs to import from the new package name
- Deletes plugins/404-viewer/ (now lives in the new repo)
- Removes pnpm-workspace.yaml (no remaining workspace packages); moves
  the onlyBuiltDependencies block into package.json under the pnpm key
- Updates CLAUDE.md to reflect the change"
```

---

## Task 33: Push and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin cutover-404-viewer-to-npm
```

- [ ] **Step 2: Open a PR**

```bash
gh pr create \
  --title "Cut over 404-viewer plugin to published npm package" \
  --body "$(cat <<'EOF'
## Summary
- Replaces local workspace `@digitalsanctuary/plugin-404-viewer` with the published `@devondragon/emdash-plugin-404-viewer@0.1.0`
- Source now lives in `devondragon/emdash-plugins`
- Removes `plugins/404-viewer/` and `pnpm-workspace.yaml`
- Moves `onlyBuiltDependencies` from `pnpm-workspace.yaml` into `package.json`

## Test plan
- [x] `./node_modules/.bin/emdash dev` starts cleanly
- [x] Admin → 404 Log page renders identically to before
- [x] Tabs, search, clear, prune all functional
- [ ] Production deploy succeeds (`pnpm deploy:prd` after merge)
- [ ] Live admin at https://www.digitalsanctuary.com/_emdash/admin shows the same plugin behavior
EOF
)"
```

- [ ] **Step 3: Wait for review / self-merge**

---

## Task 34: Deploy and verify production

- [ ] **Step 1: After merging, switch to main and pull**

```bash
git checkout main
git pull
```

- [ ] **Step 2: Deploy**

```bash
pnpm deploy:prd
```

Expected: build succeeds, worker deploys, cache purge succeeds. Note the deploy output for any warnings.

- [ ] **Step 3: Smoke test production**

Open `https://www.digitalsanctuary.com/_emdash/admin` in a browser, log in, navigate to 404 Log. Verify the same UI loads and functions.

- [ ] **Step 4: Final verification — all spec criteria**

```bash
# 1. Package on npm
npm view @devondragon/emdash-plugin-404-viewer version
# Expected: 0.1.0

# 2. No leftovers in site repo
grep -r "@digitalsanctuary/plugin-404-viewer" . --exclude-dir=node_modules --exclude-dir=.git
# Expected: no matches

# 3. plugins directory gone
ls plugins 2>&1
# Expected: No such file

# 4. workspace yaml gone
ls pnpm-workspace.yaml 2>&1
# Expected: No such file
```

---

# Phase 6 — Move the spec into the new repo

## Task 35: Move spec and plan files to the new repo

**Files:**
- Delete: `~/git/digitalsanctuary-emdash/digitalsanctuary/docs/superpowers/specs/2026-04-08-emdash-plugins-monorepo-migration.md`
- Delete: `~/git/digitalsanctuary-emdash/digitalsanctuary/docs/superpowers/plans/2026-04-08-emdash-plugins-monorepo-migration.md`
- Create: `~/git/digitalsanctuary-emdash/emdash-plugins/docs/specs/2026-04-08-emdash-plugins-monorepo-migration.md`
- Create: `~/git/digitalsanctuary-emdash/emdash-plugins/docs/plans/2026-04-08-emdash-plugins-monorepo-migration.md`

- [ ] **Step 1: Create docs directories in the new repo**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
mkdir -p docs/specs docs/plans
```

- [ ] **Step 2: Move (not copy) the files**

```bash
mv ~/git/digitalsanctuary-emdash/digitalsanctuary/docs/superpowers/specs/2026-04-08-emdash-plugins-monorepo-migration.md \
   docs/specs/2026-04-08-emdash-plugins-monorepo-migration.md
mv ~/git/digitalsanctuary-emdash/digitalsanctuary/docs/superpowers/plans/2026-04-08-emdash-plugins-monorepo-migration.md \
   docs/plans/2026-04-08-emdash-plugins-monorepo-migration.md
```

- [ ] **Step 3: Verify they moved**

```bash
ls docs/specs/ docs/plans/
ls ~/git/digitalsanctuary-emdash/digitalsanctuary/docs/superpowers/ 2>&1
```

Expected: files exist in new locations. The site repo's `docs/superpowers/` directory is empty or missing.

- [ ] **Step 4: Commit in the new repo**

```bash
cd ~/git/digitalsanctuary-emdash/emdash-plugins
git add docs/
git commit -m "docs: import migration spec and plan from digitalsanctuary repo"
git push origin main
```

- [ ] **Step 5: If the site repo still has empty `docs/superpowers/` subdirectories, clean them up**

```bash
cd ~/git/digitalsanctuary-emdash/digitalsanctuary
rmdir docs/superpowers/specs docs/superpowers/plans docs/superpowers docs 2>/dev/null || true
```

(`rmdir` only removes empty directories, so this is safe.)

- [ ] **Step 6: If anything was deleted in the site repo, commit the cleanup**

```bash
git status
```

If anything shows as deleted: stage and commit:

```bash
git add -A
git commit -m "chore: remove empty superpowers docs directories"
git push
```

---

# Final verification checklist

After all phases complete, verify the spec's six success criteria:

- [ ] **1. Package on npm**: `npm view @devondragon/emdash-plugin-404-viewer` returns metadata with version `0.1.0`. Tarball contains exactly `dist/`, `README.md`, `LICENSE`, `package.json`.
- [ ] **2. Fresh-install smoke test**: `pnpm add @devondragon/emdash-plugin-404-viewer emdash react @cloudflare/kumo @phosphor-icons/react` in a clean directory succeeds; `node_modules/@devondragon/emdash-plugin-404-viewer/dist/index.js` exists.
- [ ] **3. Site cutover works**: digitalsanctuary builds, admin loads, 404 viewer renders identically to before, all interactions functional against the existing `_emdash_404_log` table.
- [ ] **4. Production deploy**: `pnpm deploy:prd` succeeds; live admin at `https://www.digitalsanctuary.com/_emdash/admin` shows the same plugin behavior.
- [ ] **5. No leftovers**: `grep -r "@digitalsanctuary/plugin-404-viewer" .` in the site repo (excluding `node_modules/` and `.git/`) returns nothing; `plugins/404-viewer/` directory does not exist; `pnpm-workspace.yaml` does not exist.
- [ ] **6. CI green**: A no-op PR to `emdash-plugins` runs `ci.yml` successfully; merging a future changeset opens a "Version Packages" PR; merging that PR publishes a new version to npm.

All six must pass before declaring migration complete.
