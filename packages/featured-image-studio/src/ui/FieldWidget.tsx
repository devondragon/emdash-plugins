import { Button } from "@cloudflare/kumo";
import { Image as ImageIcon } from "@phosphor-icons/react";
import { apiFetch } from "emdash/plugin-utils";
import * as React from "react";
import { StudioModal, type StudioTab } from "./StudioModal.js";
import { styles } from "./styles.js";

/**
 * Field widget for image/media fields. Users opt in by setting
 * `widget: "featured-image-studio:picker"` on a field in their collection
 * schema. EmDash renders this component in place of the default media
 * picker and passes the standard field-widget contract.
 *
 * Field-widget contract assumption:
 *
 *   { value: string | null, onChange: (value: string | null) => void,
 *     field: { name: string, label?: string } }
 *
 * We accept a loose `Record<string, unknown>` + narrow at the edges to
 * stay resilient to small host-side contract tweaks; a missing `onChange`
 * falls back to a no-op so the widget at least renders.
 */
export interface FieldWidgetProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  field?: { name?: string; label?: string };
}

export function FieldWidget(props: FieldWidgetProps) {
  const { value, onChange } = props;
  const [open, setOpen] = React.useState(false);
  const [initialTab, setInitialTab] = React.useState<StudioTab>("library");
  const [lastUrl, setLastUrl] = React.useState<string | null>(null);

  // Rehydrate thumbnail URL when `value` is a stored media id. On a fresh
  // page load `lastUrl` is null, so without this the widget would fall back
  // to the "id: …" placeholder even though the image exists. We fetch the
  // single media record from the host API and cache its URL in `lastUrl`.
  React.useEffect(() => {
    if (typeof value !== "string" || !value || value.startsWith("http")) return;
    if (lastUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/_emdash/api/media/${encodeURIComponent(value)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { url?: string } } | null;
        const url = json?.data?.url ?? null;
        if (!cancelled && url) setLastUrl(url);
      } catch {
        // Non-fatal — leave the "id: …" fallback in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, lastUrl]);

  const displayUrl = lastUrl ?? (typeof value === "string" && value.startsWith("http") ? value : null);

  const openOn = (tab: StudioTab) => {
    setInitialTab(tab);
    setOpen(true);
  };

  return (
    <>
      <div style={styles.widgetWrap}>
        {displayUrl ? (
          <img src={displayUrl} alt="" style={styles.widgetThumb} />
        ) : value ? (
          <div style={styles.widgetEmptyThumb}>
            <span>id: {String(value).slice(0, 8)}…</span>
          </div>
        ) : (
          <div style={styles.widgetEmptyThumb}>
            <ImageIcon size={24} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            {props.field?.label ?? "Featured image"}
          </div>
          <div style={{ ...styles.muted, marginBottom: 8 }}>
            {value ? "Image attached. Click an option to replace." : "No image yet."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => openOn("library")}>
              Media Library
            </Button>
            <Button variant="outline" onClick={() => openOn("stock")}>
              Import / Generate
            </Button>
            {value && (
              <Button variant="outline" onClick={() => onChange?.(null)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <StudioModal
        open={open}
        initialTab={initialTab}
        showSettings={false}
        onClose={() => setOpen(false)}
        onImported={(result) => {
          setLastUrl(result.url);
          onChange?.(result.mediaId);
        }}
        onLibraryPick={(pick) => {
          setLastUrl(pick.url);
          onChange?.(pick.mediaId);
        }}
      />
    </>
  );
}
