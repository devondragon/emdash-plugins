import type { RouteContext } from "emdash";
import { z } from "zod";
import { narrowHttpContext, wrapProviderError } from "./ctx.js";
import { search } from "../providers/unsplash.js";

export const unsplashSearchInput = z.object({
  query: z.string().min(1).max(200),
  page: z.number().int().min(1).max(100).optional(),
  perPage: z.number().int().min(1).max(30).optional(),
  orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
});

export type UnsplashSearchInput = z.infer<typeof unsplashSearchInput>;

// Handler accepts RouteContext<unknown> to satisfy the invariant
// `Record<string, PluginRoute>` signature used by `PluginDefinition.routes`.
// The host has already validated `ctx.input` against `unsplashSearchInput`
// before dispatch, so the cast is runtime-safe.
export async function handleUnsplashSearch(ctx: RouteContext<unknown>) {
  const input = ctx.input as UnsplashSearchInput;
  const provider = narrowHttpContext(ctx);
  try {
    return await search(provider, input);
  } catch (err) {
    throw wrapProviderError(err);
  }
}
