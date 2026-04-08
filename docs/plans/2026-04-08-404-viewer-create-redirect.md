# 404-viewer: Create Redirect from 404 Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-row "Create Redirect" action to the 404-viewer plugin so users can resolve 404s into redirect rules in one click, without leaving the plugin page.

**Architecture:** Single-file change to `packages/404-viewer/src/admin.tsx`. Adds API helpers (create redirect, fetch current user role, search post suggestions), a `<CreateRedirectModal>`, a `<DestinationAutosuggest>`, an admin-role gate (`GET /_emdash/api/auth/me`), and a "→ Redirect" button on each row of the Summary and Log views. All network calls go through existing core APIs (`POST /_emdash/api/redirects`, `GET /_emdash/api/auth/me`, `GET /_emdash/api/search`). No new dependencies, no backend changes.

**Tech Stack:** React 19, TypeScript, `@cloudflare/kumo`, `@phosphor-icons/react`, `emdash/plugin-utils` (`apiFetch`, `parseApiResponse`, `getErrorMessage`, `isRecord`), tsdown, pnpm workspace.

**Reference spec:** `docs/specs/2026-04-08-404-viewer-create-redirect-design.md`

**Testing convention:** The existing plugin has no test infrastructure. Verification in this plan uses `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck` and `pnpm --filter @devondragon/emdash-plugin-404-viewer build` as the primary gates, plus manual smoke checks where relevant.

---

## File Structure

**Modified files:**

- `packages/404-viewer/src/admin.tsx` — all code changes (new types, API helpers, components, state, row buttons)
- `packages/404-viewer/README.md` — new "Create redirects from the log" section
- `packages/404-viewer/CHANGELOG.md` — entry added by changeset tooling
- `.changeset/404-viewer-create-redirect.md` — new changeset file (minor bump)

**No new files** in `src/`. All new components (`CreateRedirectModal`, `DestinationAutosuggest`) live inside `admin.tsx` alongside the existing `SummaryView` / `LogView` / `NotFoundPage`, matching current file conventions. If `admin.tsx` grows past ~700 lines during implementation, splitting is fine but not required.

---

## Task 1: Verify baseline builds

**Files:** none modified

- [ ] **Step 1.1: Install dependencies**

Run: `pnpm install`
Expected: installs cleanly, no errors.

- [ ] **Step 1.2: Baseline typecheck**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck`
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 1.3: Baseline build**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer build`
Expected: tsdown produces `packages/404-viewer/dist/` with `index.js`, `index.d.ts`, `admin.js`, `admin.d.ts`. No errors.

This establishes the green baseline. Do not proceed if any of the above fail — fix first.

---

## Task 2: Add redirect + auth + search types

**Files:**
- Modify: `packages/404-viewer/src/admin.tsx` (Types section, around line 14)

- [ ] **Step 2.1: Add new type definitions**

In `packages/404-viewer/src/admin.tsx`, locate the Types section (after the `NotFoundSummary` interface, around line 32) and append:

```ts
// Mirrors core's Redirect row (packages/core/src/database/repositories/redirect.ts)
interface Redirect {
	id: string;
	source: string;
	destination: string;
	type: number;
	isPattern: boolean;
	enabled: boolean;
	hits: number;
	lastHitAt: string | null;
	groupName: string | null;
	auto: boolean;
	createdAt: string;
	updatedAt: string;
}

interface CreateRedirectInput {
	source: string;
	destination: string;
	type: number;
	enabled: boolean;
	groupName?: string | null;
}

// Subset of GET /_emdash/api/auth/me we actually use
interface CurrentUser {
	id: string;
	email: string;
	name: string | null;
	role: string | number;
}

// Subset of GET /_emdash/api/search SearchResult we actually use
interface PostSuggestion {
	id: string;
	collection: string;
	slug: string | null;
	title: string | null;
}
```

- [ ] **Step 2.2: Typecheck**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck`
Expected: exits 0. (Types are declared but unused — that's fine; `noUnusedLocals` is not enabled on this package, verified against existing unused-looking imports.)

- [ ] **Step 2.3: Commit**

```bash
git add packages/404-viewer/src/admin.tsx
git commit -m "feat(404-viewer): add types for redirect creation flow"
```

---

## Task 3: Add API helpers

**Files:**
- Modify: `packages/404-viewer/src/admin.tsx` (API Helpers section, after existing `pruneOlderThan` around line 84)

- [ ] **Step 3.1: Import `parseApiResponse` and `getErrorMessage`**

Locate the existing import `import { apiFetch } from "emdash/plugin-utils";` and replace it with:

```ts
import { apiFetch, getErrorMessage, parseApiResponse } from "emdash/plugin-utils";
```

- [ ] **Step 3.2: Add `createRedirect` helper**

Append to the API Helpers section (after `pruneOlderThan`):

```ts
const REDIRECTS_BASE = "/_emdash/api/redirects";

async function createRedirect(input: CreateRedirectInput): Promise<Redirect> {
	const res = await apiFetch(REDIRECTS_BASE, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		throw new Error(await getErrorMessage(res, "Failed to create redirect"));
	}
	return parseApiResponse<Redirect>(res, "Failed to create redirect");
}
```

Note: `parseApiResponse` already checks `res.ok` and throws via `getErrorMessage`, so the explicit check above is redundant but harmless; keeping it removes the branch where `parseApiResponse` throws a less-specific message. Remove the pre-check if you prefer — both are correct.

- [ ] **Step 3.3: Add `fetchCurrentUserRole` helper**

Append:

```ts
async function fetchCurrentUser(): Promise<CurrentUser | null> {
	try {
		const res = await fetch("/_emdash/api/auth/me", { credentials: "same-origin" });
		if (!res.ok) return null;
		const json = (await res.json()) as { data?: CurrentUser };
		return json.data ?? null;
	} catch {
		return null;
	}
}
```

This uses plain `fetch` (not `apiFetch`) because GET `/auth/me` is a read and does not require the CSRF header — matching the existing pattern in `fetchSummary` / `fetchLog`.

- [ ] **Step 3.4: Add `searchPostSuggestions` helper**

Append:

```ts
async function searchPostSuggestions(
	q: string,
	signal?: AbortSignal,
): Promise<PostSuggestion[]> {
	if (!q.trim()) return [];
	const params = new URLSearchParams({ q, limit: "8" });
	const res = await fetch(`/_emdash/api/search?${params}`, {
		credentials: "same-origin",
		signal,
	});
	if (!res.ok) return [];
	const json = (await res.json()) as {
		data?: { items?: PostSuggestion[] };
	};
	return json.data?.items ?? [];
}
```

- [ ] **Step 3.5: Typecheck**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck`
Expected: exits 0.

- [ ] **Step 3.6: Commit**

```bash
git add packages/404-viewer/src/admin.tsx
git commit -m "feat(404-viewer): add createRedirect, auth/me, and search API helpers"
```

---

## Task 4: Add admin-role gate state

**Files:**
- Modify: `packages/404-viewer/src/admin.tsx` (`NotFoundPage` component, around line 299)

- [ ] **Step 4.1: Add role check helper**

Add above `NotFoundPage` (around line 298):

```ts
function isAdminRole(role: string | number | null | undefined): boolean {
	if (role == null) return false;
	if (typeof role === "string") return role.toLowerCase() === "admin";
	// Core's RoleLevel uses numeric levels; admin is the highest common level.
	// We use a conservative threshold: admin in core's auth package is 80.
	// If core changes this, update accordingly.
	return role >= 80;
}
```

- [ ] **Step 4.2: Add `canManageRedirects` state + effect in `NotFoundPage`**

Inside `NotFoundPage`, after the existing `loadingMore` state (around line 311), add:

```ts
const [canManageRedirects, setCanManageRedirects] = React.useState(false);
```

Then, after the existing `loadLog` definition (around line 351), add a new `useEffect`:

```ts
React.useEffect(() => {
	let cancelled = false;
	fetchCurrentUser().then((user) => {
		if (cancelled) return;
		setCanManageRedirects(isAdminRole(user?.role));
	});
	return () => {
		cancelled = true;
	};
}, []);
```

- [ ] **Step 4.3: Typecheck and build**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck && pnpm --filter @devondragon/emdash-plugin-404-viewer build`
Expected: both succeed.

- [ ] **Step 4.4: Commit**

```bash
git add packages/404-viewer/src/admin.tsx
git commit -m "feat(404-viewer): gate redirect creation on admin role via /auth/me"
```

---

## Task 5: Add `<DestinationAutosuggest>` component

**Files:**
- Modify: `packages/404-viewer/src/admin.tsx` (new component before `CreateRedirectModal`, after the LogView component)

- [ ] **Step 5.1: Implement the component**

Add after the `LogView` component (around line 293), before the `NotFoundPage` definition:

```tsx
function DestinationAutosuggest({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (v: string) => void;
	disabled?: boolean;
}) {
	const [query, setQuery] = React.useState("");
	const [items, setItems] = React.useState<PostSuggestion[]>([]);
	const [open, setOpen] = React.useState(false);

	// Debounce the search query by 250ms, abort stale fetches.
	React.useEffect(() => {
		if (!query.trim()) {
			setItems([]);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => {
			searchPostSuggestions(query, controller.signal)
				.then(setItems)
				.catch(() => {
					// Swallow: suggestions are a convenience, not critical.
				});
		}, 250);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value;
		onChange(v);
		setQuery(v.startsWith("/") ? v.slice(1) : v);
		setOpen(true);
	};

	const handlePick = (item: PostSuggestion) => {
		const slug = item.slug ?? "";
		onChange(`/${slug}`);
		setOpen(false);
	};

	return (
		<div style={{ position: "relative" }}>
			<Input
				placeholder="/destination-path"
				value={value}
				onChange={handleChange}
				onFocus={() => setOpen(true)}
				onBlur={() => setTimeout(() => setOpen(false), 150)}
				disabled={disabled}
				style={{ width: "100%" }}
			/>
			{open && items.length > 0 && (
				<div
					style={{
						position: "absolute",
						top: "100%",
						left: 0,
						right: 0,
						background: "var(--color-bg, #fff)",
						border: "1px solid var(--color-border, #e5e7eb)",
						borderRadius: 6,
						marginTop: 4,
						maxHeight: 240,
						overflowY: "auto",
						zIndex: 10,
						boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
					}}
				>
					{items.map((item) => (
						<button
							key={`${item.collection}:${item.id}`}
							type="button"
							onMouseDown={(e) => {
								// Prevent input blur before click handler fires
								e.preventDefault();
							}}
							onClick={() => handlePick(item)}
							style={{
								display: "block",
								width: "100%",
								textAlign: "left",
								padding: "8px 12px",
								border: "none",
								background: "transparent",
								cursor: "pointer",
								fontSize: 13,
								borderBottom: "1px solid var(--color-border, #f3f4f6)",
							}}
						>
							<div style={{ fontWeight: 600 }}>{item.title ?? "(untitled)"}</div>
							<div style={{ color: "var(--color-text-secondary, #9ca3af)", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
								/{item.collection}/{item.slug ?? item.id}
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 5.2: Typecheck**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck`
Expected: exits 0.

- [ ] **Step 5.3: Commit**

```bash
git add packages/404-viewer/src/admin.tsx
git commit -m "feat(404-viewer): add DestinationAutosuggest for redirect target"
```

---

## Task 6: Add `<CreateRedirectModal>` component

**Files:**
- Modify: `packages/404-viewer/src/admin.tsx` (new component after `DestinationAutosuggest`)

**Note on modal primitive:** `@cloudflare/kumo` may or may not export a `Dialog` component. At implementation time, try `import { Dialog } from "@cloudflare/kumo"` — if it exists, use it. If not, use the fallback overlay below. The rest of the form code is identical either way.

- [ ] **Step 6.1: Implement the modal**

Add after `DestinationAutosuggest`:

```tsx
const REDIRECT_TYPES = [
	{ value: 301, label: "301 Permanent" },
	{ value: 302, label: "302 Found" },
	{ value: 307, label: "307 Temporary" },
	{ value: 308, label: "308 Permanent" },
];

function CreateRedirectModal({
	open,
	initialSource,
	onClose,
	onSuccess,
}: {
	open: boolean;
	initialSource: string;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [source, setSource] = React.useState(initialSource);
	const [destination, setDestination] = React.useState("");
	const [type, setType] = React.useState(301);
	const [enabled, setEnabled] = React.useState(true);
	const [isPattern, setIsPattern] = React.useState(false);
	const [clearMatching, setClearMatching] = React.useState(true);
	const [submitting, setSubmitting] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [successNote, setSuccessNote] = React.useState<string | null>(null);

	// Reset form whenever a new source is opened
	React.useEffect(() => {
		if (open) {
			setSource(initialSource);
			setDestination("");
			setType(301);
			setEnabled(true);
			setIsPattern(false);
			setClearMatching(true);
			setError(null);
			setSuccessNote(null);
			setSubmitting(false);
		}
	}, [open, initialSource]);

	if (!open) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccessNote(null);

		// Minimal client-side validation; server re-validates.
		if (!source.startsWith("/") || source.startsWith("//")) {
			setError("Source must start with / and cannot be protocol-relative.");
			return;
		}
		if (!destination.startsWith("/") || destination.startsWith("//")) {
			setError("Destination must start with / and cannot be protocol-relative.");
			return;
		}
		if (source === destination) {
			setError("Source and destination must be different.");
			return;
		}

		setSubmitting(true);
		try {
			await createRedirect({ source, destination, type, enabled });
			if (clearMatching) {
				setSuccessNote(
					"Redirect created. Matching 404 log entries will stop accumulating as soon as requests start resolving. (Per-path cleanup of existing log rows is pending a core API change.)",
				);
			} else {
				setSuccessNote("Redirect created.");
			}
			// Brief pause so the user sees the success note, then close.
			setTimeout(() => {
				onSuccess();
				onClose();
			}, 1200);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create redirect.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0,0,0,0.4)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 1000,
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget && !submitting) onClose();
			}}
		>
			<form
				onSubmit={handleSubmit}
				style={{
					background: "var(--color-bg, #fff)",
					borderRadius: 8,
					padding: 24,
					width: "min(520px, 92vw)",
					maxHeight: "90vh",
					overflowY: "auto",
					boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
				}}
			>
				<h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>
					Create Redirect
				</h3>

				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					<label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
						<span style={{ fontWeight: 600 }}>Source</span>
						<Input
							value={source}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSource(e.target.value)}
							disabled={submitting}
							style={{ fontFamily: "var(--font-mono, monospace)" }}
						/>
						{isPattern && (
							<span style={{ color: "var(--color-text-secondary, #9ca3af)", fontSize: 12 }}>
								Use <code>[param]</code> for segments, <code>[...rest]</code> for catch-all.
							</span>
						)}
					</label>

					<label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
						<span style={{ fontWeight: 600 }}>Destination</span>
						{isPattern ? (
							<>
								<Input
									value={destination}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setDestination(e.target.value)
									}
									disabled={submitting}
									style={{ fontFamily: "var(--font-mono, monospace)" }}
									placeholder="/new-path/[...rest]"
								/>
								<span style={{ color: "var(--color-text-secondary, #9ca3af)", fontSize: 12 }}>
									Reference the same <code>[param]</code> / <code>[...rest]</code> names from the source.
								</span>
							</>
						) : (
							<DestinationAutosuggest
								value={destination}
								onChange={setDestination}
								disabled={submitting}
							/>
						)}
					</label>

					<label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
						<span style={{ fontWeight: 600 }}>Type</span>
						<select
							value={type}
							onChange={(e) => setType(parseInt(e.target.value, 10))}
							disabled={submitting}
							style={{
								padding: "6px 8px",
								borderRadius: 6,
								border: "1px solid var(--color-border, #e5e7eb)",
								fontSize: 13,
							}}
						>
							{REDIRECT_TYPES.map((t) => (
								<option key={t.value} value={t.value}>
									{t.label}
								</option>
							))}
						</select>
					</label>

					<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
						<input
							type="checkbox"
							checked={enabled}
							onChange={(e) => setEnabled(e.target.checked)}
							disabled={submitting}
						/>
						<span>Enabled</span>
					</label>

					<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
						<input
							type="checkbox"
							checked={isPattern}
							onChange={(e) => setIsPattern(e.target.checked)}
							disabled={submitting}
						/>
						<span>Use as pattern (Astro route syntax)</span>
					</label>

					<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
						<input
							type="checkbox"
							checked={clearMatching}
							onChange={(e) => setClearMatching(e.target.checked)}
							disabled={submitting}
						/>
						<span>Clear matching 404 log entries after creating</span>
					</label>
				</div>

				{error && (
					<div
						style={{
							marginTop: 12,
							padding: 10,
							background: "#fef2f2",
							color: "#dc2626",
							borderRadius: 6,
							fontSize: 13,
						}}
					>
						{error}
					</div>
				)}
				{successNote && (
					<div
						style={{
							marginTop: 12,
							padding: 10,
							background: "#f0fdf4",
							color: "#15803d",
							borderRadius: 6,
							fontSize: 13,
						}}
					>
						{successNote}
					</div>
				)}

				<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
					<Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button type="submit" disabled={submitting}>
						{submitting ? <Loader /> : "Create Redirect"}
					</Button>
				</div>
			</form>
		</div>
	);
}
```

- [ ] **Step 6.2: Typecheck and build**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck && pnpm --filter @devondragon/emdash-plugin-404-viewer build`
Expected: both succeed.

If the build complains about Kumo props (e.g. `Button type="submit"` or `Input onFocus/onBlur` not being in the Kumo types), cast to `any` at the call site with a comment, or wrap in a native `<button>`/`<input>` — match whatever pattern already appears in `admin.tsx` (the existing `handleSearch` form already uses `Button type="submit"`, so it should work).

- [ ] **Step 6.3: Commit**

```bash
git add packages/404-viewer/src/admin.tsx
git commit -m "feat(404-viewer): add CreateRedirectModal with pattern + cleanup toggles"
```

---

## Task 7: Wire modal into `NotFoundPage` + row buttons

**Files:**
- Modify: `packages/404-viewer/src/admin.tsx` (`NotFoundPage`, `SummaryView`, `LogView`)

- [ ] **Step 7.1: Add modal state in `NotFoundPage`**

After the `canManageRedirects` state from Task 4, add:

```ts
const [modalOpen, setModalOpen] = React.useState(false);
const [modalSource, setModalSource] = React.useState("");

const openCreateRedirect = React.useCallback((path: string) => {
	setModalSource(path);
	setModalOpen(true);
}, []);

const closeCreateRedirect = React.useCallback(() => {
	setModalOpen(false);
}, []);

const handleRedirectCreated = React.useCallback(() => {
	if (view === "summary") loadSummary();
	else loadLog();
}, [view, loadSummary, loadLog]);
```

- [ ] **Step 7.2: Pass props to `SummaryView` and `LogView`**

In the `NotFoundPage` JSX, replace:

```tsx
) : view === "summary" ? (
    <SummaryView items={summary} onRefresh={loadSummary} />
) : (
    <LogView
        items={logItems}
        cursor={logCursor}
        loading={loadingMore}
        onLoadMore={() => loadLog(true, logCursor ?? undefined)}
    />
)}
```

with:

```tsx
) : view === "summary" ? (
    <SummaryView
        items={summary}
        onRefresh={loadSummary}
        canCreateRedirect={canManageRedirects}
        onCreateRedirect={openCreateRedirect}
    />
) : (
    <LogView
        items={logItems}
        cursor={logCursor}
        loading={loadingMore}
        onLoadMore={() => loadLog(true, logCursor ?? undefined)}
        canCreateRedirect={canManageRedirects}
        onCreateRedirect={openCreateRedirect}
    />
)}

<CreateRedirectModal
    open={modalOpen}
    initialSource={modalSource}
    onClose={closeCreateRedirect}
    onSuccess={handleRedirectCreated}
/>
```

- [ ] **Step 7.3: Update `SummaryView` signature + add action cell**

Replace the existing `SummaryView` function signature and body with:

```tsx
function SummaryView({
	items,
	onRefresh,
	canCreateRedirect,
	onCreateRedirect,
}: {
	items: NotFoundSummary[];
	onRefresh: () => void;
	canCreateRedirect: boolean;
	onCreateRedirect: (path: string) => void;
}) {
	if (items.length === 0) {
		return (
			<div style={styles.empty}>
				<p>No 404s recorded yet.</p>
				<p style={styles.muted}>Entries will appear here after your site receives requests for missing pages.</p>
			</div>
		);
	}

	return (
		<table style={styles.table}>
			<thead>
				<tr>
					<th style={styles.th}>Path</th>
					<th style={{ ...styles.th, textAlign: "right" }}>Hits</th>
					<th style={styles.th}>Last Seen</th>
					<th style={styles.th}>Top Referrer</th>
					{canCreateRedirect && <th style={styles.th} aria-label="Actions" />}
				</tr>
			</thead>
			<tbody>
				{items.map((item) => (
					<tr key={item.path}>
						<td style={{ ...styles.td, ...styles.pathCell }}>{item.path}</td>
						<td style={{ ...styles.td, textAlign: "right" }}>
							<Badge variant={item.count >= 10 ? "red" : item.count >= 3 ? "orange" : "outline"}>
								{item.count}
							</Badge>
						</td>
						<td style={{ ...styles.td, ...styles.muted }}>{timeAgo(item.lastSeen)}</td>
						<td style={{ ...styles.td, ...styles.muted }}>
							{item.topReferrer ? truncate(item.topReferrer, 50) : "—"}
						</td>
						{canCreateRedirect && (
							<td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
								<Button
									variant="outline"
									onClick={() => onCreateRedirect(item.path)}
								>
									→ Redirect
								</Button>
							</td>
						)}
					</tr>
				))}
			</tbody>
		</table>
	);
}
```

Note: `onRefresh` was already an unused prop in the original code. Leave it — removing it is out of scope.

- [ ] **Step 7.4: Update `LogView` signature + add action cell**

Replace the existing `LogView` with:

```tsx
function LogView({
	items,
	cursor,
	loading,
	onLoadMore,
	canCreateRedirect,
	onCreateRedirect,
}: {
	items: NotFoundEntry[];
	cursor: string | null;
	loading: boolean;
	onLoadMore: () => void;
	canCreateRedirect: boolean;
	onCreateRedirect: (path: string) => void;
}) {
	if (items.length === 0 && !loading) {
		return (
			<div style={styles.empty}>
				<p>No 404 log entries found.</p>
			</div>
		);
	}

	return (
		<>
			<table style={styles.table}>
				<thead>
					<tr>
						<th style={styles.th}>Path</th>
						<th style={styles.th}>Referrer</th>
						<th style={styles.th}>Time</th>
						{canCreateRedirect && <th style={styles.th} aria-label="Actions" />}
					</tr>
				</thead>
				<tbody>
					{items.map((entry) => (
						<tr key={entry.id}>
							<td style={{ ...styles.td, ...styles.pathCell }}>{entry.path}</td>
							<td style={{ ...styles.td, ...styles.muted }}>
								{entry.referrer ? truncate(entry.referrer, 60) : "—"}
							</td>
							<td style={{ ...styles.td, ...styles.muted, whiteSpace: "nowrap" }}>
								{timeAgo(entry.createdAt)}
							</td>
							{canCreateRedirect && (
								<td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
									<Button
										variant="outline"
										onClick={() => onCreateRedirect(entry.path)}
									>
										→ Redirect
									</Button>
								</td>
							)}
						</tr>
					))}
				</tbody>
			</table>
			{cursor && (
				<div style={styles.loadMore}>
					<Button variant="outline" onClick={onLoadMore} disabled={loading}>
						{loading ? <Loader /> : "Load more"}
					</Button>
				</div>
			)}
		</>
	);
}
```

- [ ] **Step 7.5: Typecheck and build**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck && pnpm --filter @devondragon/emdash-plugin-404-viewer build`
Expected: both succeed.

- [ ] **Step 7.6: Commit**

```bash
git add packages/404-viewer/src/admin.tsx
git commit -m "feat(404-viewer): wire Create Redirect button into Summary and Log views"
```

---

## Task 8: Manual smoke test

**Files:** none modified

This task is a checklist, not code. The repo has no E2E harness for plugin admin UIs and the existing plugin has no unit tests. The goal is a manual sanity pass against a running EmDash site.

- [ ] **Step 8.1: Prepare test environment**

You need an EmDash site that depends on a local link of this package, with:
- An admin user you can log in as
- At least a few rows in `_emdash_404_log` (generate by hitting `/does-not-exist` a couple of times on the site)
- A non-admin user (EDITOR or lower) for the perm check

Link the plugin into your test site with `pnpm link` or a path dep — however you normally develop this plugin.

- [ ] **Step 8.2: Verify admin sees the button**

Log in as admin. Navigate to the 404 Log plugin page. Confirm:
- Summary view shows a "→ Redirect" button at the end of each row
- Log view shows the same
- Clicking the button opens the modal with the row's path prefilled

- [ ] **Step 8.3: Verify non-admin does not see the button**

Log in as a non-admin user. Navigate to the 404 Log plugin page. Confirm:
- No "→ Redirect" buttons appear in either view

- [ ] **Step 8.4: Create an exact redirect**

As admin, open the modal for a known 404 path. Type a destination. Submit. Confirm:
- Network tab shows `POST /_emdash/api/redirects` with 201 response
- Success note appears
- Modal closes after ~1.2s
- The 404 row is still visible (expected per spec — per-path cleanup is a followup)
- Refresh: navigating to the source path on the site now redirects to the destination

- [ ] **Step 8.5: Create a pattern redirect**

Open the modal. Toggle "Use as pattern". Set source to something like `/old-blog/[...rest]` and destination to `/blog/[...rest]`. Submit. Confirm:
- 201 response
- The autosuggest dropdown is hidden while the pattern toggle is on
- Visiting `/old-blog/anything` on the site now redirects to `/blog/anything`

- [ ] **Step 8.6: Verify error handling**

Open the modal. Set destination equal to source. Submit. Confirm:
- Inline error shows the server's "Source and destination must be different" message
- Modal stays open, form retains state

- [ ] **Step 8.7: Verify autosuggest**

Open the modal. Click in destination. Type a word that matches a post title. Confirm:
- After ~250ms a dropdown shows up to 8 matches
- Each shows title bold, `/collection/slug` muted
- Clicking fills the destination with `/slug`

- [ ] **Step 8.8: No commit**

This task produces no code changes. Skip the commit step.

---

## Task 9: Update README + changeset

**Files:**
- Modify: `packages/404-viewer/README.md`
- Create: `.changeset/404-viewer-create-redirect.md`

- [ ] **Step 9.1: Update README**

Open `packages/404-viewer/README.md` and locate the `## Features` section. Replace it with:

```markdown
## Features

- **Summary view** — paths grouped by hit count, with severity badges and "last seen" timestamps.
- **Full log view** — paginated browsing with search-by-path.
- **Create redirect from a 404** — admins get a "→ Redirect" button on each row that opens a modal to post a new rule via EmDash's built-in redirects API. Supports exact paths or Astro-style patterns (`[param]`, `[...rest]`), includes post-title autosuggest for the destination, and picks from 301/302/307/308.
- **Prune older than N days** — bulk delete with a date threshold.
- **Clear all** — wipes the entire log (confirms first).
```

Also add a new note to the `## Notes` section at the bottom:

```markdown
- Creating a redirect requires the `redirects:manage` permission (admin role). Non-admin users will not see the "→ Redirect" buttons.
- Destination autosuggest uses EmDash's search API and fills the field with `/<slug>`; you may need to edit to match your collection's route (e.g. `/blog/<slug>`).
```

- [ ] **Step 9.2: Create changeset**

Create `.changeset/404-viewer-create-redirect.md` with:

```markdown
---
"@devondragon/emdash-plugin-404-viewer": minor
---

Add "Create Redirect" flow: admins can now convert a 404 log entry into a redirect rule via a modal, without leaving the plugin page. Supports exact paths, Astro-style patterns, destination autosuggest from the search API, and 301/302/307/308 types.
```

- [ ] **Step 9.3: Final typecheck and build**

Run: `pnpm --filter @devondragon/emdash-plugin-404-viewer typecheck && pnpm --filter @devondragon/emdash-plugin-404-viewer build`
Expected: both succeed.

- [ ] **Step 9.4: Commit**

```bash
git add packages/404-viewer/README.md .changeset/404-viewer-create-redirect.md
git commit -m "docs(404-viewer): document Create Redirect flow + changeset"
```

---

## Task 10: File core followup issue (optional, can defer)

**Files:** none in this repo

- [ ] **Step 10.1: Open a tracking issue**

On `github.com/emdash-cms/emdash`, open an issue titled:

> Add `path` filter to `POST /_emdash/api/redirects/404s` prune body

Body:

> The `404-viewer` plugin has a "Clear matching 404 log entries" checkbox
> in its Create Redirect flow, but core's prune endpoint currently only
> accepts `{olderThan}`. Adding an optional `path?: string` (and
> `pathPrefix?: string`) to `notFoundPruneBody` would let the plugin
> actually delete the log rows that are now resolved by the new redirect.
>
> Suggested shape:
>
> ```ts
> export const notFoundPruneBody = z.object({
>   olderThan: z.string().datetime().optional(),
>   path: z.string().optional(),
>   pathPrefix: z.string().optional(),
> }).refine(o => o.olderThan || o.path || o.pathPrefix, {
>   message: "At least one of olderThan, path, or pathPrefix is required",
> });
> ```

This is intentionally the last task — it unblocks a future tweak but does not block merging the plan.

---

## Self-Review Notes

- Spec coverage: every section of the spec is covered (API helpers T3, role gate T4, autosuggest T5, modal T6, pattern toggle T6, row buttons T7, cleanup caveat copy T6, README/changeset T9, followup issue T10). No unit tests because the spec explicitly excluded them.
- Placeholder scan: no TBDs, no "similar to earlier task", every code block is complete.
- Type consistency: `CreateRedirectInput`, `Redirect`, `CurrentUser`, `PostSuggestion` are defined in T2 and used unchanged in T3/T5/T6. `canManageRedirects` prop name matches across T4/T7. `onCreateRedirect` callback signature matches across `NotFoundPage`/`SummaryView`/`LogView`.
