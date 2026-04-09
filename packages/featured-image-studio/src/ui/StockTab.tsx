import { Button, Input, Loader } from "@cloudflare/kumo";
import { MagnifyingGlass } from "@phosphor-icons/react";
import * as React from "react";

import type {
  StockImportResponse,
  StockResult,
  StockSearchResponse,
} from "../providers/types.js";
import { importUnsplashPhoto, searchUnsplash } from "./api.js";
import { styles } from "./styles.js";

type Orientation = "any" | "landscape" | "portrait" | "squarish";

export interface StockTabProps {
  /**
   * Called after a successful import. The modal host uses this to close
   * itself and/or forward the media id to a field widget.
   */
  onImported: (result: StockImportResponse, source: StockResult) => void;
}

export function StockTab({ onImported }: StockTabProps) {
  const [query, setQuery] = React.useState("");
  const [orientation, setOrientation] = React.useState<Orientation>("any");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<StockSearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runSearch = React.useCallback(
    async (nextPage: number) => {
      if (!query.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const result = await searchUnsplash({
          query: query.trim(),
          page: nextPage,
          perPage: 24,
          orientation: orientation === "any" ? undefined : orientation,
        });
        setData(result);
        setPage(nextPage);
      } catch (e) {
        const err = e as Error & { code?: string };
        if (err.code === "missing_key") {
          setError("No Unsplash Access Key configured. Open the Settings tab and paste your key.");
        } else {
          setError(err.message || "Search failed.");
        }
      } finally {
        setLoading(false);
      }
    },
    [query, orientation],
  );

  // NOTE: we deliberately do NOT wrap these inputs in a <form>. The widget
  // can be mounted inside the host's post editor, which already has an outer
  // <form> for the post itself. Nested forms are invalid HTML and cause the
  // inner submit to bubble to the outer form, triggering a full-page reload
  // of the post editor mid-search. Handling Enter manually avoids that.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch(1);
    }
  };

  const handleImport = async (item: StockResult) => {
    setImportingId(item.id);
    setError(null);
    try {
      const result = await importUnsplashPhoto(item.id, item.alt || undefined);
      onImported(result, item);
    } catch (e) {
      const err = e as Error;
      setError(err.message || "Import failed.");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div>
      <div style={styles.searchBar}>
        <Input
          placeholder="Search Unsplash..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, minWidth: 200 }}
          autoFocus
        />
        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value as Orientation)}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--color-border, #d1d5db)",
            background: "var(--color-bg, #fff)",
            fontSize: 13,
          }}
        >
          <option value="any">Any orientation</option>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="squarish">Square</option>
        </select>
        <Button
          type="button"
          variant="primary"
          disabled={loading || !query.trim()}
          onClick={() => runSearch(1)}
        >
          <MagnifyingGlass size={14} /> Search
        </Button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading && !data && (
        <div style={styles.loadingCenter}>
          <Loader />
        </div>
      )}

      {!loading && !data && (
        <div style={styles.empty}>
          <p>Search Unsplash for a photo to add to your media library.</p>
          <p style={styles.muted}>Free tier: 50 requests/hour.</p>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div style={styles.empty}>
          <p>No photos matched “{query}”.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div style={styles.grid}>
            {data.items.map((item) => {
              const busy = importingId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.card,
                    opacity: busy ? 0.6 : 1,
                    pointerEvents: importingId ? "none" : "auto",
                  }}
                  onClick={() => !importingId && handleImport(item)}
                  title={`Click to import — photo by ${item.photographer.name}`}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.alt || `Photo by ${item.photographer.name}`}
                    style={styles.cardImage}
                    loading="lazy"
                  />
                  <div style={styles.cardMeta}>
                    <span style={styles.cardAttribution}>
                      {busy ? "Importing…" : `© ${item.photographer.name}`}
                    </span>
                    <span>
                      {item.width}×{item.height}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.pagination}>
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => runSearch(page - 1)}
            >
              ← Previous
            </Button>
            <span style={styles.muted}>
              Page {page} of {data.totalPages} ({data.total.toLocaleString()} results)
            </span>
            <Button
              variant="outline"
              disabled={page >= data.totalPages || loading}
              onClick={() => runSearch(page + 1)}
            >
              Next →
            </Button>
          </div>
        </>
      )}

      <div style={{ ...styles.muted, marginTop: 16, textAlign: "center" }}>
        Photos from{" "}
        <a
          href="https://unsplash.com?utm_source=emdash&utm_medium=referral"
          target="_blank"
          rel="noreferrer"
        >
          Unsplash
        </a>
        . By using this plugin you agree to the Unsplash API terms — photographer credit is stored
        automatically on import.
      </div>
    </div>
  );
}
