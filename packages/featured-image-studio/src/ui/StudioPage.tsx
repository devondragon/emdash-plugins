import * as React from "react";
import type { StockImportResponse, StockResult } from "../providers/types.js";
import { StudioPicker } from "./StudioModal.js";
import { styles } from "./styles.js";

interface LastImport {
  result: StockImportResponse;
  source: StockResult;
}

/**
 * Standalone admin page at `/_emdash/admin/plugins/featured-image-studio/`.
 *
 * Images imported here go straight into the media library; after each
 * successful import we surface a small confirmation banner so the user knows
 * exactly which asset was created without navigating away.
 */
export function StudioPage() {
  const [lastImport, setLastImport] = React.useState<LastImport | null>(null);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Featured Image Studio</h2>
        <div style={styles.muted}>Unified stock + AI picker for featured images</div>
      </div>

      {lastImport && (
        <div style={styles.info}>
          Imported <strong>{lastImport.source.alt || `Unsplash ${lastImport.source.id}`}</strong> —
          photo by{" "}
          <a href={lastImport.source.photographer.profileUrl} target="_blank" rel="noreferrer">
            {lastImport.source.photographer.name}
          </a>
          . Media id: <code>{lastImport.result.mediaId}</code>.
        </div>
      )}

      <StudioPicker
        initialTab="stock"
        onImported={(result, source) => setLastImport({ result, source })}
      />
    </div>
  );
}
