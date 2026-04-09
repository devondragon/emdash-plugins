/**
 * Key management routes: status probe + save.
 *
 * These exist so the in-studio Settings tab can manage the Unsplash Access
 * Key directly, without sending the user off to the host-generated
 * `settingsSchema` form. We never return the actual key value from any
 * route — only whether one is set — so a compromised admin session can't
 * exfiltrate it through this plugin's API.
 */

import type { RouteContext } from "emdash";
import { PluginRouteError } from "emdash";
import { z } from "zod";

const KV_KEY_ACCESS_KEY = "settings:unsplashAccessKey";

export async function handleKeyStatus(ctx: RouteContext<unknown>) {
  const value = await ctx.kv.get<string>(KV_KEY_ACCESS_KEY);
  const present = typeof value === "string" && value.trim().length > 0;
  return {
    hasKey: present,
    // Show just the trailing four characters as a confirmation hint, so the
    // user can eyeball that the key they expect is actually the one stored
    // without us ever returning the full secret.
    hint: present ? `…${(value as string).slice(-4)}` : null,
  };
}

export const saveKeyInput = z.object({
  key: z.string().min(1).max(200),
});

export type SaveKeyInput = z.infer<typeof saveKeyInput>;

export async function handleSaveKey(ctx: RouteContext<unknown>) {
  const input = ctx.input as SaveKeyInput;
  const trimmed = input.key.trim();
  if (!trimmed) {
    throw PluginRouteError.badRequest("Key cannot be empty.");
  }
  await ctx.kv.set(KV_KEY_ACCESS_KEY, trimmed);
  return { ok: true };
}

export async function handleClearKey(ctx: RouteContext<unknown>) {
  await ctx.kv.delete(KV_KEY_ACCESS_KEY);
  return { ok: true };
}
