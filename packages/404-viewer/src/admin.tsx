/**
 * 404 Log Viewer — Admin UI
 *
 * Shows 404 log entries from EmDash's built-in _emdash_404_log table.
 * Fetches from the existing /_emdash/api/redirects/404s endpoints.
 */

import { Badge, Button, Input, Loader } from "@cloudflare/kumo";
import { Trash, MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";
import type { PluginAdminExports } from "emdash";
import { apiFetch, getErrorMessage, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

// =============================================================================
// Types (mirrors EmDash's NotFoundEntry / NotFoundSummary)
// =============================================================================

interface NotFoundEntry {
	id: string;
	path: string;
	referrer: string | null;
	userAgent: string | null;
	ip: string | null;
	createdAt: string;
}

interface NotFoundSummary {
	path: string;
	count: number;
	lastSeen: string;
	topReferrer: string | null;
}

type ViewMode = "summary" | "log";

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

// Subset of GET /_emdash/api/auth/me we actually use.
// NOTE: role shape is assumed based on plan guidance — core's RoleLevel is
// numeric with admin == 80. If core changes this, update isAdminRole below.
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

// =============================================================================
// API Helpers
// =============================================================================

const API_BASE = "/_emdash/api/redirects/404s";

async function fetchSummary(limit = 100): Promise<NotFoundSummary[]> {
	const res = await fetch(`${API_BASE}/summary?limit=${limit}`, {
		credentials: "same-origin",
	});
	if (!res.ok) throw new Error(`Failed to fetch 404 summary: ${res.status}`);
	const json = await res.json();
	return json.data?.items ?? [];
}

async function fetchLog(opts: {
	limit?: number;
	cursor?: string;
	search?: string;
}): Promise<{ items: NotFoundEntry[]; cursor: string | null }> {
	const params = new URLSearchParams();
	if (opts.limit) params.set("limit", String(opts.limit));
	if (opts.cursor) params.set("cursor", opts.cursor);
	if (opts.search) params.set("search", opts.search);
	const res = await fetch(`${API_BASE}?${params}`, {
		credentials: "same-origin",
	});
	if (!res.ok) throw new Error(`Failed to fetch 404 log: ${res.status}`);
	const json = await res.json();
	return { items: json.data?.items ?? [], cursor: json.data?.cursor ?? null };
}

async function clearAll(): Promise<number> {
	const res = await apiFetch(API_BASE, { method: "DELETE" });
	if (!res.ok) throw new Error(`Failed to clear 404 log: ${res.status}`);
	const json = await res.json();
	return json.data?.deleted ?? 0;
}

async function pruneOlderThan(olderThan: string): Promise<number> {
	const res = await apiFetch(API_BASE, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ olderThan }),
	});
	if (!res.ok) throw new Error(`Failed to prune 404 log: ${res.status}`);
	const json = await res.json();
	return json.data?.deleted ?? 0;
}

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

// =============================================================================
// Formatting
// =============================================================================

function timeAgo(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}

function truncate(str: string, max: number): string {
	return str.length > max ? str.slice(0, max) + "…" : str;
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
	container: {
		fontFamily: "var(--font-sans, system-ui, sans-serif)",
		maxWidth: 960,
		margin: "0 auto",
	} as React.CSSProperties,
	header: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
		gap: 12,
		flexWrap: "wrap",
	} as React.CSSProperties,
	title: {
		fontSize: 20,
		fontWeight: 600,
		margin: 0,
	} as React.CSSProperties,
	controls: {
		display: "flex",
		gap: 8,
		alignItems: "center",
		flexWrap: "wrap",
	} as React.CSSProperties,
	table: {
		width: "100%",
		borderCollapse: "collapse" as const,
		fontSize: 13,
	} as React.CSSProperties,
	th: {
		textAlign: "left" as const,
		padding: "8px 12px",
		borderBottom: "2px solid var(--color-border, #e5e7eb)",
		fontWeight: 600,
		fontSize: 12,
		textTransform: "uppercase" as const,
		letterSpacing: "0.05em",
		color: "var(--color-text-secondary, #6b7280)",
	} as React.CSSProperties,
	td: {
		padding: "8px 12px",
		borderBottom: "1px solid var(--color-border, #f3f4f6)",
		verticalAlign: "top",
	} as React.CSSProperties,
	pathCell: {
		fontFamily: "var(--font-mono, monospace)",
		fontSize: 12,
		wordBreak: "break-all" as const,
	} as React.CSSProperties,
	muted: {
		color: "var(--color-text-secondary, #9ca3af)",
		fontSize: 12,
	} as React.CSSProperties,
	empty: {
		textAlign: "center" as const,
		padding: 40,
		color: "var(--color-text-secondary, #9ca3af)",
	} as React.CSSProperties,
	loadMore: {
		display: "flex",
		justifyContent: "center",
		padding: 16,
	} as React.CSSProperties,
	tabs: {
		display: "flex",
		gap: 4,
		marginBottom: 16,
	} as React.CSSProperties,
	tab: (active: boolean) =>
		({
			padding: "6px 14px",
			borderRadius: 6,
			border: "none",
			cursor: "pointer",
			fontSize: 13,
			fontWeight: active ? 600 : 400,
			background: active ? "var(--color-bg-active, #e5e7eb)" : "transparent",
			color: active ? "var(--color-text, #111)" : "var(--color-text-secondary, #6b7280)",
		}) as React.CSSProperties,
};

// =============================================================================
// Summary View
// =============================================================================

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
	void onRefresh;
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

// =============================================================================
// Log View
// =============================================================================

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

// =============================================================================
// Main Page
// =============================================================================

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

function isAdminRole(role: string | number | null | undefined): boolean {
	if (role == null) return false;
	if (typeof role === "string") return role.toLowerCase() === "admin";
	// ASSUMPTION: core's RoleLevel uses numeric levels; admin is the highest
	// common level (80). If core changes this threshold, update here.
	return role >= 80;
}

function NotFoundPage() {
	const [view, setView] = React.useState<ViewMode>("summary");
	const [search, setSearch] = React.useState("");
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	// Summary state
	const [summary, setSummary] = React.useState<NotFoundSummary[]>([]);

	// Log state
	const [logItems, setLogItems] = React.useState<NotFoundEntry[]>([]);
	const [logCursor, setLogCursor] = React.useState<string | null>(null);
	const [loadingMore, setLoadingMore] = React.useState(false);

	const [canManageRedirects, setCanManageRedirects] = React.useState(false);
	const [modalOpen, setModalOpen] = React.useState(false);
	const [modalSource, setModalSource] = React.useState("");

	const loadSummary = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const items = await fetchSummary();
			setSummary(items);
		} catch (e: any) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}, []);

	const loadLog = React.useCallback(
		async (append = false, cursor?: string) => {
			if (append) setLoadingMore(true);
			else setLoading(true);
			setError(null);
			try {
				const result = await fetchLog({
					limit: 50,
					cursor,
					search: search || undefined,
				});
				if (append) {
					setLogItems((prev) => [...prev, ...result.items]);
				} else {
					setLogItems(result.items);
				}
				setLogCursor(result.cursor);
			} catch (e: any) {
				setError(e.message);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[search],
	);

	// Load data on mount and view change
	React.useEffect(() => {
		if (view === "summary") loadSummary();
		else loadLog();
	}, [view, loadSummary, loadLog]);

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

	const handleClear = async () => {
		if (!confirm("Clear all 404 log entries? This cannot be undone.")) return;
		try {
			const deleted = await clearAll();
			setSummary([]);
			setLogItems([]);
			setLogCursor(null);
			alert(`Cleared ${deleted} entries.`);
		} catch (e: any) {
			alert(`Error: ${e.message}`);
		}
	};

	const handlePrune = async () => {
		const days = prompt("Delete entries older than how many days?", "30");
		if (!days) return;
		const d = parseInt(days, 10);
		if (isNaN(d) || d < 1) return alert("Enter a valid number of days.");
		const olderThan = new Date(Date.now() - d * 86400000).toISOString();
		try {
			const deleted = await pruneOlderThan(olderThan);
			alert(`Pruned ${deleted} entries older than ${d} days.`);
			if (view === "summary") loadSummary();
			else loadLog();
		} catch (e: any) {
			alert(`Error: ${e.message}`);
		}
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		loadLog();
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h2 style={styles.title}>404 Log</h2>
				<div style={styles.controls}>
					<Button variant="outline" onClick={handlePrune}>
						<FunnelSimple size={14} /> Prune
					</Button>
					<Button variant="outline" onClick={handleClear}>
						<Trash size={14} /> Clear All
					</Button>
				</div>
			</div>

			<div style={styles.tabs}>
				<button style={styles.tab(view === "summary")} onClick={() => setView("summary")}>
					Summary
				</button>
				<button style={styles.tab(view === "log")} onClick={() => setView("log")}>
					Full Log
				</button>
			</div>

			{view === "log" && (
				<form onSubmit={handleSearch} style={{ marginBottom: 12, display: "flex", gap: 8 }}>
					<Input
						placeholder="Search paths..."
						value={search}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
						style={{ flex: 1 }}
					/>
					<Button variant="outline" type="submit">
						<MagnifyingGlass size={14} />
					</Button>
				</form>
			)}

			{error && (
				<div style={{ padding: 12, background: "#fef2f2", borderRadius: 6, color: "#dc2626", marginBottom: 12, fontSize: 13 }}>
					{error}
				</div>
			)}

			{loading ? (
				<div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
					<Loader />
				</div>
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
		</div>
	);
}

// =============================================================================
// Exports
// =============================================================================

export const pages: PluginAdminExports["pages"] = {
	"/": NotFoundPage,
};
