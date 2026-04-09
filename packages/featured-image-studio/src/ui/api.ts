/**
 * Browser-side client for this plugin's backend routes, plus the media
 * upload helper that talks directly to EmDash's built-in media REST
 * endpoint.
 *
 * Uses `apiFetch` from `emdash/plugin-utils` so CSRF / same-origin headers
 * are handled consistently with the rest of the admin UI.
 */

import { apiFetch } from "emdash/plugin-utils";
import type {
  StockAttribution,
  StockFetchedPhoto,
  StockImportResponse,
  StockSearchInput,
  StockSearchResponse,
} from "../providers/types.js";

const ROUTE_BASE = "/_emdash/api/plugins/featured-image-studio";
const MEDIA_ENDPOINT = "/_emdash/api/media";

interface RouteError extends Error {
  status?: number;
  code?: string;
}

async function callRoute<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(`${ROUTE_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw Object.assign(new Error(`Invalid response from ${path} (status ${res.status}).`), {
      status: res.status,
    } as RouteError);
  }
  if (!res.ok) {
    const env = json as { error?: { message?: string; code?: string } } | null;
    const message =
      env?.error?.message ?? `Request to ${path} failed with status ${res.status}.`;
    throw Object.assign(new Error(message), {
      status: res.status,
      code: env?.error?.code,
    } as RouteError);
  }
  // EmDash route envelope is `{ data: T }` for success responses; fall back
  // to the raw value for hosts that skip the envelope.
  const env = json as { data?: T } | null;
  return (env?.data ?? (json as T)) as T;
}

// =============================================================================
// Public API — search, key management, full import flow
// =============================================================================

export function searchUnsplash(input: StockSearchInput): Promise<StockSearchResponse> {
  return callRoute<StockSearchResponse>("unsplash/search", input);
}

export function testUnsplashKey(): Promise<{ ok: true }> {
  return callRoute<{ ok: true }>("unsplash/test-key", {});
}

export interface KeyStatus {
  hasKey: boolean;
  hint: string | null;
}

export function getKeyStatus(): Promise<KeyStatus> {
  return callRoute<KeyStatus>("unsplash/key-status", {});
}

export function saveUnsplashKey(key: string): Promise<{ ok: true }> {
  return callRoute<{ ok: true }>("unsplash/save-key", { key });
}

export function clearUnsplashKey(): Promise<{ ok: true }> {
  return callRoute<{ ok: true }>("unsplash/clear-key", {});
}

/**
 * Full three-step import flow:
 *
 *   1. Plugin backend: fetch photo detail, ping download tracker (TOS),
 *      download full-res bytes, return base64 + attribution metadata.
 *   2. Browser: POST the bytes to `/_emdash/api/media` as multipart, so
 *      the upload happens under the current admin session (which has
 *      direct access to the media pipeline; plugin contexts do not in
 *      emdash v0.1.0).
 *   3. Plugin backend: persist attribution metadata keyed by the new
 *      mediaId, so themes / future versions can render credit without
 *      needing to hit Unsplash again.
 *
 * Returns the final `StockImportResponse` combining the resulting media
 * record with the stored attribution.
 */
export async function importUnsplashPhoto(
  photoId: string,
  alt?: string,
): Promise<StockImportResponse> {
  const fetched = await callRoute<StockFetchedPhoto>("unsplash/fetch-bytes", {
    photoId,
    alt,
  });

  const mediaRecord = await uploadBytesToMedia(fetched);

  // Persist attribution as part of the blocking import flow so failures
  // surface to the caller (and a retry can be triggered by re-importing).
  // KV latency is acceptable here — the full import is already a
  // multi-step round-trip and users expect it to take a moment.
  await callRoute<{ ok: true }>("unsplash/save-attribution", {
    mediaId: mediaRecord.id,
    alt: fetched.alt,
    attribution: fetched.attribution,
  });

  return {
    mediaId: mediaRecord.id,
    url: mediaRecord.url,
    attribution: fetched.attribution,
  };
}

// =============================================================================
// Media library upload helper
// =============================================================================

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number | null;
  url: string;
}

async function uploadBytesToMedia(photo: StockFetchedPhoto): Promise<MediaItem> {
  const blob = base64ToBlob(photo.bytes, photo.contentType);
  const file = new File([blob], photo.filename, { type: photo.contentType });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("width", String(photo.width));
  formData.append("height", String(photo.height));
  // Pass attribution-decorated alt through to the media endpoint. The stock
  // emdash v0.1.0 media handler may ignore unknown fields, but any host that
  // does read it will surface the photographer credit in its media library.
  if (photo.alt) formData.append("alt", photo.alt);

  const res = await apiFetch(MEDIA_ENDPOINT, {
    method: "POST",
    body: formData,
    // Let the browser set the multipart boundary — do NOT set Content-Type.
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw Object.assign(
      new Error(`Invalid response from media upload (status ${res.status}).`),
      { status: res.status } as RouteError,
    );
  }
  if (!res.ok) {
    const env = json as { error?: { message?: string } } | null;
    throw Object.assign(
      new Error(env?.error?.message ?? `Media upload failed (${res.status}).`),
      { status: res.status } as RouteError,
    );
  }
  const env = json as { data?: { item: MediaItem } } | null;
  const item = env?.data?.item;
  if (!item) {
    throw new Error("Media upload succeeded but response did not include a media record.");
  }
  return item;
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

// Re-export for tabs that want to display attribution info.
export type { StockAttribution };
