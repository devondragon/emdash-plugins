/**
 * 404 Log Viewer — Admin UI
 *
 * Shows 404 log entries from EmDash's built-in _emdash_404_log table.
 * Fetches from the existing /_emdash/api/redirects/404s endpoints.
 */

import { Badge, Button, Input, Loader } from "@cloudflare/kumo";
import { Trash, MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";
import type { PluginAdminExports } from "emdash";
import { apiFetch } from "emdash/plugin-utils";
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

function SummaryView({ items, onRefresh }: { items: NotFoundSummary[]; onRefresh: () => void }) {
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
				</tr>
			</thead>
			<tbody>
				{items.map((item) => (
					<tr key={item.path}>
						<td style={{ ...styles.td, ...styles.pathCell }}>{item.path}</td>
						<td style={{ ...styles.td, textAlign: "right" }}>
							<Badge variant={item.count >= 10 ? "danger" : item.count >= 3 ? "warning" : "default"}>
								{item.count}
							</Badge>
						</td>
						<td style={{ ...styles.td, ...styles.muted }}>{timeAgo(item.lastSeen)}</td>
						<td style={{ ...styles.td, ...styles.muted }}>
							{item.topReferrer ? truncate(item.topReferrer, 50) : "—"}
						</td>
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
}: {
	items: NotFoundEntry[];
	cursor: string | null;
	loading: boolean;
	onLoadMore: () => void;
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
				<SummaryView items={summary} onRefresh={loadSummary} />
			) : (
				<LogView
					items={logItems}
					cursor={logCursor}
					loading={loadingMore}
					onLoadMore={() => loadLog(true, logCursor ?? undefined)}
				/>
			)}
		</div>
	);
}

// =============================================================================
// Exports
// =============================================================================

export const pages: PluginAdminExports["pages"] = {
	"/": NotFoundPage,
};
