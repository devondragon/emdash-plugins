import { Loader } from "@cloudflare/kumo";
import { apiFetch } from "emdash/plugin-utils";
import * as React from "react";

import { styles } from "./styles.js";

/**
 * Minimal wire shape for items returned by `GET /_emdash/api/media`. We only
 * rely on the fields we render or need to build a selection payload; any
 * extra host-added keys are harmless.
 */
interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
}

export interface LibraryTabProps {
  /** Fired when the user clicks an existing media item. */
  onPick: (item: { mediaId: string; url: string; alt?: string | null }) => void;
}

/**
 * Read-only browser over the host's media library. Lives inside the
 * Studio modal alongside Stock / AI / Settings so users who opened the
 * widget to replace an image can still reach their already-uploaded
 * media without being forced through an external picker.
 *
 * Intentionally narrow scope: no upload, no delete, no search. The host's
 * own media manager remains the canonical place for those operations;
 * this tab just exists to make "pick an existing image" one click away.
 */
export function LibraryTab({ onPick }: LibraryTabProps) {
  const [items, setItems] = React.useState<MediaItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiFetch("/_emdash/api/media?mimeType=image/&limit=100");
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        if (!res.ok) {
          const env = json as { error?: { message?: string } } | null;
          throw new Error(env?.error?.message ?? `Media list failed (${res.status})`);
        }
        const envelope = json as { data?: { items?: MediaItem[] } } | null;
        const list = envelope?.data?.items ?? [];
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Failed to load media.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !items) {
    return (
      <div style={styles.loadingCenter}>
        <Loader />
      </div>
    );
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!items || items.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No images in the media library yet.</p>
        <p style={styles.muted}>
          Use the Stock tab to import from Unsplash, or upload images via the host’s media manager.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {items.map((item) => (
        <div
          key={item.id}
          style={styles.card}
          onClick={() => onPick({ mediaId: item.id, url: item.url, alt: item.alt })}
          title={item.filename}
        >
          <img src={item.url} alt={item.alt ?? ""} style={styles.cardImage} loading="lazy" />
          <div style={styles.cardMeta}>
            <span style={styles.cardAttribution}>{item.filename}</span>
            {item.width && item.height && (
              <span>
                {item.width}×{item.height}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
