/**
 * Inline style objects shared across the Featured Image Studio admin UI.
 *
 * We mirror the 404-viewer plugin's inline-styles approach rather than
 * shipping a stylesheet so the plugin has zero CSS build steps and
 * automatically picks up host CSS variables for theming.
 */

import type * as React from "react";

export const styles = {
  container: {
    fontFamily: "var(--font-sans, system-ui, sans-serif)",
    maxWidth: 1080,
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
  muted: {
    color: "var(--color-text-secondary, #6b7280)",
    fontSize: 13,
  } as React.CSSProperties,
  tabs: {
    display: "flex",
    gap: 4,
    marginBottom: 16,
    borderBottom: "1px solid var(--color-border, #e5e7eb)",
  } as React.CSSProperties,
  tab: (active: boolean, disabled = false) =>
    ({
      padding: "8px 16px",
      borderRadius: "6px 6px 0 0",
      border: "none",
      borderBottom: active ? "2px solid var(--color-accent, #3b82f6)" : "2px solid transparent",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      background: "transparent",
      color: disabled
        ? "var(--color-text-secondary, #9ca3af)"
        : active
          ? "var(--color-text, #111)"
          : "var(--color-text-secondary, #6b7280)",
      opacity: disabled ? 0.6 : 1,
    }) as React.CSSProperties,
  searchBar: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
    alignItems: "center",
    flexWrap: "wrap",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
  } as React.CSSProperties,
  card: {
    position: "relative" as const,
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--color-bg-subtle, #f3f4f6)",
    cursor: "pointer",
    border: "1px solid var(--color-border, #e5e7eb)",
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,
  cardImage: {
    width: "100%",
    height: 160,
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,
  cardMeta: {
    padding: "8px 10px",
    fontSize: 11,
    color: "var(--color-text-secondary, #6b7280)",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  } as React.CSSProperties,
  cardAttribution: {
    flex: 1,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,
  empty: {
    textAlign: "center" as const,
    padding: 48,
    color: "var(--color-text-secondary, #9ca3af)",
  } as React.CSSProperties,
  error: {
    padding: 12,
    background: "#fef2f2",
    borderRadius: 6,
    color: "#dc2626",
    marginBottom: 12,
    fontSize: 13,
  } as React.CSSProperties,
  info: {
    padding: 12,
    background: "#eff6ff",
    borderRadius: 6,
    color: "#1e40af",
    marginBottom: 12,
    fontSize: 13,
  } as React.CSSProperties,
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 16,
  } as React.CSSProperties,
  loadingCenter: {
    display: "flex",
    justifyContent: "center",
    padding: 40,
  } as React.CSSProperties,
  modalBackdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  } as React.CSSProperties,
  modalBody: {
    background: "var(--color-bg, #fff)",
    borderRadius: 12,
    width: "100%",
    maxWidth: 1080,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  } as React.CSSProperties,
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid var(--color-border, #e5e7eb)",
  } as React.CSSProperties,
  modalContent: {
    padding: 20,
    overflowY: "auto" as const,
    flex: 1,
  } as React.CSSProperties,
  widgetWrap: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 12,
    border: "1px dashed var(--color-border, #d1d5db)",
    borderRadius: 8,
  } as React.CSSProperties,
  widgetThumb: {
    width: 96,
    height: 96,
    borderRadius: 6,
    objectFit: "cover" as const,
    background: "var(--color-bg-subtle, #f3f4f6)",
  } as React.CSSProperties,
  widgetEmptyThumb: {
    width: 96,
    height: 96,
    borderRadius: 6,
    background: "var(--color-bg-subtle, #f3f4f6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--color-text-secondary, #9ca3af)",
    fontSize: 11,
  } as React.CSSProperties,
};
