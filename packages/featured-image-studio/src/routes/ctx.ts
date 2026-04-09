/**
 * Route-context helpers.
 *
 * `PluginContext.http` is typed as optional on EmDash's side because it's
 * capability-gated. We declare `network:fetch`, so at runtime it's always
 * present — but TS can't know that. `narrowHttpContext` asserts presence
 * with a `PluginRouteError` so the UI gets a real message if something
 * ever goes sideways.
 *
 * Media uploads do NOT happen server-side in this plugin. `ctx.media.upload`
 * is not wired up by the emdash v0.1.0 runtime. See the comment at the top
 * of `providers/unsplash.ts` for the full flow — backend fetches bytes,
 * browser uploads them to `/_emdash/api/media`, backend then persists
 * attribution metadata.
 *
 * We throw with a concrete code (NOT `INTERNAL_ERROR`, which emdash masks
 * to "Plugin route error" to avoid leaking stack traces from untrusted
 * plugins) so the real reason surfaces in the UI.
 */

import type { PluginContext } from "emdash";
import { PluginRouteError } from "emdash";
import { UnsplashProviderError, type UnsplashProviderContext } from "../providers/unsplash.js";

export function narrowHttpContext(ctx: PluginContext): UnsplashProviderContext {
  if (!ctx.http) {
    throw new PluginRouteError(
      "CAPABILITY_MISSING",
      "featured-image-studio: network:fetch capability not provisioned on context.",
      500,
    );
  }
  return {
    http: ctx.http,
    kv: ctx.kv,
    log: ctx.log,
  };
}

/**
 * Convert provider errors into `PluginRouteError` so the host preserves the
 * message + status in the response envelope. Plain `Error` throws get masked
 * to "Plugin route error" because emdash treats them as unhandled internal
 * exceptions (to avoid leaking stack traces from untrusted plugins).
 */
export function wrapProviderError(err: unknown): PluginRouteError {
  if (err instanceof PluginRouteError) return err;
  if (err instanceof UnsplashProviderError) {
    const codeMap: Record<string, string> = {
      missing_key: "MISSING_KEY",
      unauthorized: "UNAUTHORIZED",
      rate_limited: "RATE_LIMITED",
      not_found: "NOT_FOUND",
      upstream_error: "UPSTREAM_ERROR",
      download_failed: "DOWNLOAD_FAILED",
    };
    return new PluginRouteError(
      codeMap[err.code] ?? "PLUGIN_ERROR",
      err.message,
      err.status,
    );
  }
  // Unknown error — surface the message (unmasked) but keep status 500.
  const message = err instanceof Error ? err.message : String(err);
  return new PluginRouteError("PLUGIN_ERROR", message, 500);
}
