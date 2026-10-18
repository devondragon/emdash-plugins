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
 * picker.
 *
 * Field-widget contract (emdash 1.x admin, `PluginField` render):
 *
 *   { value, onChange, label, id, required, options, validation, minimal }
 *
 * `value` for `image` / `file` fields is an object, not a bare media id.
 * The built-in renderers write `{ id, provider, alt, width, height,
 * filename, mimeType, meta: { storageKey }, ... }` and treat a plain string
 * as an image URL. We write the same object shape so the site's
 * `<Image image={...} />` and the default editors can read what we store.
 * Legacy string values (a media id written by plugin versions <= 0.2.x, or
 * a URL) are still displayed.
 */
export interface MediaFieldValue {
  id: string;
  provider?: string;
  src?: string;
  previewUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
  filename?: string;
  mimeType?: string;
  size?: number;
  blurhash?: string;
  dominantColor?: string;
  meta?: Record<string, unknown>;
}

export interface FieldWidgetProps {
  value?: MediaFieldValue | string | null;
  onChange?: (value: MediaFieldValue | null) => void;
  label?: string;
  id?: string;
  required?: boolean;
}

/** Wire shape of `GET /_emdash/api/media/:id` → `{ data: { item } }`. */
interface MediaRecord {
  id: string;
  filename: string;
  mimeType: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  storageKey: string;
  blurhash?: string | null;
  dominantColor?: string | null;
  meta?: Record<string, unknown> | null;
}

const MEDIA_FILE_PREFIX = "/_emdash/api/media/file/";

async function fetchMediaRecord(mediaId: string): Promise<MediaRecord | null> {
  const res = await apiFetch(`/_emdash/api/media/${encodeURIComponent(mediaId)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { item?: MediaRecord } } | null;
  return json?.data?.item ?? null;
}

function toFieldValue(item: MediaRecord): MediaFieldValue {
  return {
    id: item.id,
    provider: "local",
    alt: item.alt ?? "",
    width: item.width ?? undefined,
    height: item.height ?? undefined,
    filename: item.filename,
    mimeType: item.mimeType,
    size: item.size ?? undefined,
    blurhash: item.blurhash ?? undefined,
    dominantColor: item.dominantColor ?? undefined,
    meta: { ...(item.meta ?? {}), storageKey: item.storageKey },
  };
}

/** Preview URL for a stored value, or null if one has to be fetched. */
function storedDisplayUrl(value: FieldWidgetProps["value"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return /^(https?:)?\/\//.test(value) || value.startsWith("/") ? value : null;
  if (value.previewUrl || value.src) return value.previewUrl ?? value.src ?? null;
  const key = value.meta?.storageKey;
  if (typeof key === "string" && key) return `${MEDIA_FILE_PREFIX}${key}`;
  return null;
}

/** Media id to rehydrate from when the stored value carries no URL. */
function storedMediaId(value: FieldWidgetProps["value"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return storedDisplayUrl(value) ? null : value;
  return value.id || null;
}

export function FieldWidget(props: FieldWidgetProps) {
  const { value, onChange } = props;
  const [open, setOpen] = React.useState(false);
  const [initialTab, setInitialTab] = React.useState<StudioTab>("library");
  const [lastUrl, setLastUrl] = React.useState<string | null>(null);
  const [selectError, setSelectError] = React.useState<string | null>(null);

  const immediateUrl = storedDisplayUrl(value);
  const rehydrateId = immediateUrl ? null : storedMediaId(value);

  // Rehydrate the thumbnail when the stored value has no URL (a legacy bare
  // media id). The media GET returns the record without a `url`, so build
  // it from `storageKey`.
  React.useEffect(() => {
    if (!rehydrateId || lastUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const item = await fetchMediaRecord(rehydrateId);
        if (!cancelled && item?.storageKey) setLastUrl(`${MEDIA_FILE_PREFIX}${item.storageKey}`);
      } catch {
        // Non-fatal — leave the "id: …" fallback in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rehydrateId, lastUrl]);

  const displayUrl = lastUrl ?? immediateUrl;

  // Resolve a picked/imported media id into the object shape EmDash stores
  // for image/file fields, then hand it to the editor.
  const selectMedia = async (mediaId: string, url: string) => {
    setLastUrl(url);
    setSelectError(null);
    try {
      const item = await fetchMediaRecord(mediaId);
      if (!item) throw new Error("Media record not found.");
      onChange?.(toFieldValue(item));
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : "Could not attach the selected image.");
    }
  };

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
            <span>id: {String(rehydrateId ?? "").slice(0, 8)}…</span>
          </div>
        ) : (
          <div style={styles.widgetEmptyThumb}>
            <ImageIcon size={24} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            {props.label ?? "Featured image"}
          </div>
          <div style={{ ...styles.muted, marginBottom: 8 }}>
            {value ? "Image attached. Click an option to replace." : "No image yet."}
          </div>
          {selectError && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{selectError}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => openOn("library")}>
              Media Library
            </Button>
            <Button variant="outline" onClick={() => openOn("stock")}>
              Import / Generate
            </Button>
            {value && (
              <Button
                variant="outline"
                onClick={() => {
                  setLastUrl(null);
                  onChange?.(null);
                }}
              >
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
          void selectMedia(result.mediaId, result.url);
        }}
        onLibraryPick={(pick) => {
          void selectMedia(pick.mediaId, pick.url);
        }}
      />
    </>
  );
}
