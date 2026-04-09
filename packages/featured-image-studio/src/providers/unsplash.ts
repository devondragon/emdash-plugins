/**
 * Unsplash stock provider.
 *
 * Server-side only — runs inside EmDash plugin route handlers. Uses
 * `ctx.http.fetch` (host-restricted to api.unsplash.com + images.unsplash.com)
 * to search and fetch image bytes.
 *
 * IMPORTANT: We do NOT call `ctx.media.upload` from here. In emdash v0.1.0
 * the context factory wires `ctx.media` only when the host provides a
 * `getUploadUrl` function, which the stock astro/cloudflare runtime does not
 * — so plugin-initiated media uploads are unavailable. Instead, the backend
 * fetches the bytes and returns them (base64) to the browser, which performs
 * the upload via the admin session's `POST /_emdash/api/media` endpoint.
 * The backend then persists attribution keyed by the mediaId the browser
 * reports back via `saveAttribution()`.
 *
 * Unsplash TOS compliance notes:
 * - We MUST ping the `download_location` URL *only* when the user actually
 *   decides to use a photo (i.e. on fetch), not at search time.
 *   See https://help.unsplash.com/en/articles/2511315-guideline-triggering-a-download
 * - Photographer attribution MUST be preserved and displayed. We return it
 *   to the UI alongside the fetched bytes AND persist it under
 *   `state:attribution:<mediaId>` in KV so themes / future versions can
 *   render it from the server side.
 */

import type {
  StockAttribution,
  StockFetchedPhoto,
  StockResult,
  StockSearchInput,
  StockSearchResponse,
} from "./types.js";

// =============================================================================
// Minimal subset of the plugin route context we rely on.
//
// EmDash's public types are not re-exported in a stable enough shape for us
// to import directly; we pin the narrow slice of the contract we actually use
// so a change on the EmDash side gives us a clean compile error instead of a
// silent runtime failure.
// =============================================================================

export interface UnsplashProviderContext {
  http: { fetch: (url: string, init?: RequestInit) => Promise<Response> };
  kv: {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
  };
  log: {
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
  };
}

// =============================================================================
// Errors
// =============================================================================

export class UnsplashProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code:
      | "missing_key"
      | "unauthorized"
      | "rate_limited"
      | "not_found"
      | "upstream_error"
      | "download_failed",
  ) {
    super(message);
    this.name = "UnsplashProviderError";
  }
}

// =============================================================================
// API shapes from Unsplash (partial — only what we use)
// =============================================================================

interface UnsplashUser {
  name: string;
  username: string;
  links: { html: string };
}

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  width: number;
  height: number;
  color: string | null;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  links: { self: string; html: string; download: string; download_location: string };
  user: UnsplashUser;
}

interface UnsplashSearchPayload {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

// =============================================================================
// Helpers
// =============================================================================

const API_ROOT = "https://api.unsplash.com";
const KV_KEY_ACCESS_KEY = "settings:unsplashAccessKey";
const KV_ATTRIBUTION_PREFIX = "state:attribution:";
const UNSPLASH_API_VERSION = "v1";

async function getAccessKey(ctx: UnsplashProviderContext): Promise<string> {
  const key = await ctx.kv.get<string>(KV_KEY_ACCESS_KEY);
  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new UnsplashProviderError(
      "Unsplash access key not configured. Set it in plugin settings.",
      400,
      "missing_key",
    );
  }
  return key;
}

function authHeaders(accessKey: string): Record<string, string> {
  return {
    Authorization: `Client-ID ${accessKey}`,
    "Accept-Version": UNSPLASH_API_VERSION,
  };
}

function normalizePhoto(p: UnsplashPhoto): StockResult {
  return {
    id: p.id,
    source: "unsplash",
    thumbUrl: p.urls.thumb,
    previewUrl: p.urls.small,
    fullUrl: p.urls.regular,
    width: p.width,
    height: p.height,
    color: p.color,
    alt: p.alt_description ?? p.description ?? "",
    photographer: {
      name: p.user.name,
      profileUrl: `${p.user.links.html}?utm_source=emdash&utm_medium=referral`,
    },
    sourceUrl: `${p.links.html}?utm_source=emdash&utm_medium=referral`,
  };
}

async function unsplashFetch(
  ctx: UnsplashProviderContext,
  url: string,
  accessKey: string,
): Promise<Response> {
  const res = await ctx.http.fetch(url, { headers: authHeaders(accessKey) });
  if (res.status === 401 || res.status === 403) {
    // Unsplash uses 403 for rate-limit-exceeded in addition to permissions.
    const isRateLimit =
      res.status === 403 &&
      (res.headers.get("x-ratelimit-remaining") === "0" ||
        (await peekBody(res)).toLowerCase().includes("rate limit"));
    throw new UnsplashProviderError(
      isRateLimit
        ? "Unsplash rate limit exceeded. Try again later (free tier is 50 requests/hour)."
        : "Unsplash rejected the request. Check that your access key is valid.",
      res.status,
      isRateLimit ? "rate_limited" : "unauthorized",
    );
  }
  if (res.status === 404) {
    throw new UnsplashProviderError("Photo not found on Unsplash.", 404, "not_found");
  }
  if (!res.ok) {
    throw new UnsplashProviderError(
      `Unsplash returned ${res.status}.`,
      res.status,
      "upstream_error",
    );
  }
  return res;
}

async function peekBody(res: Response): Promise<string> {
  try {
    return await res.clone().text();
  } catch {
    return "";
  }
}

function extractRateLimit(res: Response): { limit: number | null; remaining: number | null } {
  const parse = (v: string | null) => (v === null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    limit: parse(res.headers.get("x-ratelimit-limit")),
    remaining: parse(res.headers.get("x-ratelimit-remaining")),
  };
}

function contentTypeToExtension(contentType: string): string {
  const clean = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (clean === "image/jpeg" || clean === "image/jpg") return "jpg";
  if (clean === "image/png") return "png";
  if (clean === "image/webp") return "webp";
  if (clean === "image/avif") return "avif";
  if (clean === "image/gif") return "gif";
  return "jpg";
}

// =============================================================================
// Public provider API
// =============================================================================

export async function search(
  ctx: UnsplashProviderContext,
  input: StockSearchInput,
): Promise<StockSearchResponse> {
  const accessKey = await getAccessKey(ctx);
  const page = input.page ?? 1;
  const perPage = Math.min(Math.max(input.perPage ?? 24, 1), 30);
  const params = new URLSearchParams({
    query: input.query,
    page: String(page),
    per_page: String(perPage),
    content_filter: "high",
  });
  if (input.orientation) params.set("orientation", input.orientation);

  const res = await unsplashFetch(ctx, `${API_ROOT}/search/photos?${params}`, accessKey);
  const payload = (await res.json()) as UnsplashSearchPayload;

  return {
    items: payload.results.map(normalizePhoto),
    total: payload.total,
    totalPages: payload.total_pages,
    rateLimit: extractRateLimit(res),
  };
}

/** Ping Unsplash's download tracker (required on actual use, per TOS). */
export async function pingDownload(
  ctx: UnsplashProviderContext,
  downloadLocation: string,
  accessKey: string,
): Promise<void> {
  try {
    await unsplashFetch(ctx, downloadLocation, accessKey);
  } catch (err) {
    // Tracking ping is best-effort — log but don't block the import.
    ctx.log.warn("unsplash download ping failed", { err: String(err) });
  }
}

/**
 * Fetch a photo's full-resolution bytes and return them (base64) along with
 * attribution metadata. The caller (browser) is expected to upload the bytes
 * to `/_emdash/api/media` and then call `saveAttribution()` with the new
 * mediaId. This function performs the Unsplash download-tracking ping as
 * required by the TOS.
 */
export async function fetchPhotoBytes(
  ctx: UnsplashProviderContext,
  photoId: string,
  altOverride?: string,
): Promise<StockFetchedPhoto> {
  const accessKey = await getAccessKey(ctx);

  // 1. Fetch photo detail to get current urls + signed download_location.
  const detailRes = await unsplashFetch(
    ctx,
    `${API_ROOT}/photos/${encodeURIComponent(photoId)}`,
    accessKey,
  );
  const photo = (await detailRes.json()) as UnsplashPhoto;

  // 2. Ping download tracker (TOS requirement — only on actual use).
  await pingDownload(ctx, photo.links.download_location, accessKey);

  // 3. Fetch the full image bytes. images.unsplash.com is whitelisted.
  const imgRes = await ctx.http.fetch(photo.urls.full, { headers: { Accept: "image/*" } });
  if (!imgRes.ok) {
    throw new UnsplashProviderError(
      `Failed to download image bytes (status ${imgRes.status}).`,
      imgRes.status,
      "download_failed",
    );
  }
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const buffer = await imgRes.arrayBuffer();
  const filename = `unsplash-${photo.id}.${contentTypeToExtension(contentType)}`;

  // Decorate alt text with photographer credit so that attribution is visible
  // wherever the media record's alt is surfaced (media library listings, img
  // tags rendered in themes, etc.). Until the emdash host exposes a way to
  // attach structured attribution to a media record directly, embedding the
  // credit into alt is the only channel that persists through the generic
  // media upload endpoint.
  const rawAlt = altOverride ?? photo.alt_description ?? photo.description ?? "";
  const credit = `Photo by ${photo.user.name} on Unsplash`;
  const decoratedAlt = rawAlt ? `${rawAlt} — ${credit}` : credit;

  const attribution: StockAttribution = {
    source: "unsplash",
    photographer: {
      name: photo.user.name,
      profileUrl: `${photo.user.links.html}?utm_source=emdash&utm_medium=referral`,
    },
    sourceUrl: `${photo.links.html}?utm_source=emdash&utm_medium=referral`,
    providerPhotoId: photo.id,
    license: "unsplash",
  };

  ctx.log.info("unsplash bytes fetched", {
    photoId: photo.id,
    bytes: buffer.byteLength,
    contentType,
  });

  return {
    bytes: arrayBufferToBase64(buffer),
    contentType,
    filename,
    width: photo.width,
    height: photo.height,
    alt: decoratedAlt,
    attribution,
  };
}

/**
 * Persist attribution metadata once the browser has uploaded the bytes and
 * received a media id. Best-effort — KV write failures log but do not throw.
 */
export async function saveAttribution(
  ctx: UnsplashProviderContext,
  mediaId: string,
  attribution: StockAttribution,
  alt: string,
): Promise<void> {
  try {
    await ctx.kv.set(`${KV_ATTRIBUTION_PREFIX}${mediaId}`, {
      ...attribution,
      alt,
      importedAt: new Date().toISOString(),
    });
    ctx.log.info("unsplash attribution saved", { mediaId });
  } catch (err) {
    ctx.log.warn("attribution metadata write failed", { err: String(err), mediaId });
  }
}

/**
 * Browser-friendly base64 encoder for ArrayBuffer. Runs in V8 (Workers)
 * where `btoa` is available. Chunked to avoid call-stack overflow on large
 * buffers from `String.fromCharCode.apply`.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function testKey(ctx: UnsplashProviderContext): Promise<{ ok: true; username?: string }> {
  const accessKey = await getAccessKey(ctx);
  // /me requires a user auth token; for access-key-only validation, hit /photos with per_page=1.
  const res = await unsplashFetch(ctx, `${API_ROOT}/photos?per_page=1`, accessKey);
  await res.json();
  return { ok: true };
}
