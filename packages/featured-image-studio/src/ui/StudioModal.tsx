import * as React from "react";
import type { StockImportResponse, StockResult } from "../providers/types.js";
import { AiTabComingSoon } from "./AiTabComingSoon.js";
import { LibraryTab } from "./LibraryTab.js";
import { SettingsTab } from "./SettingsTab.js";
import { StockTab } from "./StockTab.js";
import { styles } from "./styles.js";

export type StudioTab = "library" | "stock" | "ai" | "settings";

export interface LibraryPick {
  mediaId: string;
  url: string;
  alt?: string | null;
}

export interface StudioPickerProps {
  /**
   * Called when a stock photo has been imported (fetched + uploaded to the
   * host media library + attribution persisted). The `source` carries the
   * original provider result so callers can display credit inline.
   */
  onImported: (result: StockImportResponse, source: StockResult) => void;
  /**
   * Called when the user picks an existing item from the Library tab.
   * Kept separate from `onImported` so callers can distinguish "fresh
   * import with attribution to save" vs "just reference what we already
   * have".
   */
  onLibraryPick?: (pick: LibraryPick) => void;
  /**
   * Tab to open on first render. Defaults to "library" — most uses of the
   * widget are "swap my existing featured image", not "go find a new
   * stock photo".
   */
  initialTab?: StudioTab;
  /**
   * Whether to show the Settings tab. Defaults to true for the standalone
   * admin page; the FieldWidget passes `false` because plugin-scoped
   * settings don't belong inside a per-post editor picker (and rendering
   * SettingsTab there would nest its form inside the outer post form).
   */
  showSettings?: boolean;
}

/**
 * The tab UI — shared between the standalone Studio page (rendered inline)
 * and the FieldWidget dialog (rendered inside a modal wrapper). Four tabs:
 *
 *  - Library — read-only browser of the host's media library.
 *  - Stock (Unsplash) — search + import flow, functional in v0.1.
 *  - AI Generation — scaffolded, disabled until v0.2.
 *  - Settings — plugin-scoped preferences, TOS notes, and a "Test key"
 *    helper. Lives here rather than as a separate sidebar entry so the
 *    scope is unambiguous (it's not site-wide settings).
 */
export function StudioPicker({
  onImported,
  onLibraryPick,
  initialTab = "library",
  showSettings = true,
}: StudioPickerProps) {
  const [tab, setTab] = React.useState<StudioTab>(
    initialTab === "settings" && !showSettings ? "library" : initialTab,
  );

  // When the parent passes a new initialTab (e.g. user clicked a different
  // button on the field widget), follow it.
  React.useEffect(() => {
    if (initialTab === "settings" && !showSettings) {
      setTab("library");
    } else {
      setTab(initialTab);
    }
  }, [initialTab, showSettings]);

  const tabButton = (id: StudioTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      style={styles.tab(tab === id)}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div style={styles.tabs} role="tablist">
        {tabButton("library", "Media Library")}
        {tabButton("stock", "Stock (Unsplash)")}
        {tabButton("ai", "AI Generation")}
        {showSettings && tabButton("settings", "Settings")}
      </div>

      {tab === "library" && (
        <LibraryTab
          onPick={(pick) => {
            onLibraryPick?.(pick);
          }}
        />
      )}
      {tab === "stock" && <StockTab onImported={onImported} />}
      {tab === "ai" && <AiTabComingSoon />}
      {tab === "settings" && showSettings && <SettingsTab />}
    </>
  );
}

export interface StudioModalProps extends StudioPickerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog wrapper used by the field widget. Click-outside / Escape closes.
 */
export function StudioModal({
  open,
  onClose,
  onImported,
  onLibraryPick,
  initialTab,
  showSettings,
}: StudioModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Featured Image Studio"
    >
      <div style={styles.modalBody}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Featured Image Studio</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              color: "var(--color-text-secondary, #6b7280)",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
        <div style={styles.modalContent}>
          <StudioPicker
            initialTab={initialTab}
            showSettings={showSettings}
            onImported={(result, source) => {
              onImported(result, source);
              onClose();
            }}
            onLibraryPick={(pick) => {
              onLibraryPick?.(pick);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
