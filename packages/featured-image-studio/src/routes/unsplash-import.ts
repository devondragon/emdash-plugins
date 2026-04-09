import type { RouteContext } from "emdash";
import { z } from "zod";
import {
  fetchPhotoBytes,
  saveAttribution,
  testKey,
} from "../providers/unsplash.js";
import { narrowHttpContext, wrapProviderError } from "./ctx.js";

// =============================================================================
// unsplash/fetch-bytes — backend fetches a photo + its bytes, returns base64
//                       to the browser for upload via the REST media endpoint.
// =============================================================================

export const unsplashFetchBytesInput = z.object({
  photoId: z.string().min(1).max(128),
  alt: z.string().max(500).optional(),
});

export type UnsplashFetchBytesInput = z.infer<typeof unsplashFetchBytesInput>;

export async function handleUnsplashFetchBytes(ctx: RouteContext<unknown>) {
  const input = ctx.input as UnsplashFetchBytesInput;
  const provider = narrowHttpContext(ctx);
  try {
    return await fetchPhotoBytes(provider, input.photoId, input.alt);
  } catch (err) {
    throw wrapProviderError(err);
  }
}

// =============================================================================
// unsplash/save-attribution — browser calls this after uploading bytes to the
//                             media endpoint and receiving a mediaId.
// =============================================================================

export const saveAttributionInput = z.object({
  mediaId: z.string().min(1).max(128),
  alt: z.string().max(500),
  attribution: z.object({
    source: z.literal("unsplash"),
    photographer: z.object({
      name: z.string(),
      profileUrl: z.string(),
    }),
    sourceUrl: z.string(),
    providerPhotoId: z.string(),
    license: z.string(),
  }),
});

export type SaveAttributionInput = z.infer<typeof saveAttributionInput>;

export async function handleSaveAttribution(ctx: RouteContext<unknown>) {
  const input = ctx.input as SaveAttributionInput;
  const provider = narrowHttpContext(ctx);
  try {
    await saveAttribution(provider, input.mediaId, input.attribution, input.alt);
    return { ok: true };
  } catch (err) {
    throw wrapProviderError(err);
  }
}

// =============================================================================
// unsplash/test-key — lightweight "is my key valid?" probe, no input.
// =============================================================================

export async function handleUnsplashTestKey(ctx: RouteContext<unknown>) {
  const provider = narrowHttpContext(ctx);
  try {
    return await testKey(provider);
  } catch (err) {
    throw wrapProviderError(err);
  }
}
