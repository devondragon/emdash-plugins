/**
 * Shared types for stock image providers.
 *
 * These types are used on both the server (route handlers / provider
 * implementations) and the browser (admin UI). Keep them runtime-free so
 * `import type` works from either bundle.
 */

export type StockSource = "unsplash";

export interface StockPhotographer {
  name: string;
  profileUrl: string;
}

export interface StockResult {
  /** Provider-native id, e.g. an Unsplash photo id. */
  id: string;
  source: StockSource;
  thumbUrl: string;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  /** Dominant color hex, if the provider returns one. */
  color: string | null;
  /** Provider-supplied alt text (may be empty). */
  alt: string;
  photographer: StockPhotographer;
  /** Canonical provider URL for the photo (for attribution links). */
  sourceUrl: string;
}

export interface StockSearchInput {
  query: string;
  page?: number;
  perPage?: number;
  orientation?: "landscape" | "portrait" | "squarish";
}

export interface StockSearchResponse {
  items: StockResult[];
  total: number;
  totalPages: number;
  /** Best-effort surfaced rate-limit info from the provider, when available. */
  rateLimit?: { limit: number | null; remaining: number | null };
}

export interface StockAttribution {
  source: StockSource;
  photographer: StockPhotographer;
  sourceUrl: string;
  /** Provider id of the original photo, for de-duplication / re-attribution. */
  providerPhotoId: string;
  /** License identifier for the provider's terms (e.g. "unsplash"). */
  license: string;
}

/**
 * Result of the backend "fetch photo" step — returned to the browser so it
 * can perform the actual media-library upload through the existing
 * `/_emdash/api/media` REST endpoint. The plugin backend can't call that
 * endpoint directly (it's same-origin and needs the admin session cookie),
 * so the browser does the upload and the backend persists the attribution
 * afterwards, keyed by the resulting mediaId.
 *
 * Bytes are base64-encoded so they can travel through the JSON-only plugin
 * route envelope. ~33% overhead, acceptable for the photo sizes we fetch.
 */
export interface StockFetchedPhoto {
  /** Base64-encoded image bytes. */
  bytes: string;
  contentType: string;
  filename: string;
  width: number;
  height: number;
  alt: string;
  attribution: StockAttribution;
}

/**
 * Final result of the full import flow, surfaced to the UI after the
 * browser has both uploaded the bytes AND asked the backend to persist
 * attribution metadata.
 */
export interface StockImportResponse {
  mediaId: string;
  url: string;
  attribution: StockAttribution;
}
