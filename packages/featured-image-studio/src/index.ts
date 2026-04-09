/**
 * @devondragon/emdash-plugin-featured-image-studio
 *
 * Native-format plugin entry point. Exports:
 *  - `featuredImageStudioPlugin()` — the `PluginDescriptor` factory users add
 *    to `emdash({ plugins: [...] })`. Metadata only — points at `entrypoint`
 *    and `adminEntry` so EmDash knows where to load runtime + admin bundles.
 *  - `createPlugin()` / default export — the `ResolvedPlugin` factory loaded
 *    by the host at runtime. This is where the real `routes`, `admin.pages`,
 *    `admin.settingsSchema`, and `admin.fieldWidgets` live.
 *
 * v0.1 registers a single admin page (the Studio, with Stock / AI / Settings
 * tabs inside), a field widget, and three backend routes (Unsplash search +
 * import + key test). See README / plan for the full scope decisions.
 */

import type { PluginDefinition, PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

import {
  unsplashSearchInput,
  handleUnsplashSearch,
} from "./routes/unsplash-search.js";
import {
  unsplashFetchBytesInput,
  handleUnsplashFetchBytes,
  saveAttributionInput,
  handleSaveAttribution,
  handleUnsplashTestKey,
} from "./routes/unsplash-import.js";
import {
  handleKeyStatus,
  handleSaveKey,
  handleClearKey,
  saveKeyInput,
} from "./routes/unsplash-key.js";

export const PLUGIN_ID = "featured-image-studio";
export const PLUGIN_VERSION = "0.1.0";
export const PLUGIN_ENTRYPOINT = "@devondragon/emdash-plugin-featured-image-studio";
export const PLUGIN_ADMIN_ENTRYPOINT =
  "@devondragon/emdash-plugin-featured-image-studio/admin";

/**
 * Descriptor factory — metadata only. The `PluginDescriptor` type declares
 * `adminPages`, but the EmDash runtime sidebar registration also reads
 * `admin.pages`. We provide both and cast to satisfy the narrower
 * compile-time type, matching the pattern used by the 404-viewer plugin in
 * this repo.
 */
export function featuredImageStudioPlugin(): PluginDescriptor {
  return {
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    entrypoint: PLUGIN_ENTRYPOINT,
    format: "native",
    adminEntry: PLUGIN_ADMIN_ENTRYPOINT,
    capabilities: ["network:fetch"],
    allowedHosts: ["api.unsplash.com", "images.unsplash.com"],
    adminPages: [{ path: "/", label: "Image Studio", icon: "image" }],
    admin: {
      pages: [{ path: "/", label: "Image Studio", icon: "image" }],
    },
  } as unknown as PluginDescriptor;
}

/**
 * Runtime plugin factory. Native format: `definePlugin` takes the full
 * `PluginDefinition` (id + version + routes + admin config) and returns a
 * `ResolvedPlugin`.
 */
export function createPlugin(): ResolvedPlugin {
  const definition: PluginDefinition = {
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    capabilities: ["network:fetch"],
    allowedHosts: ["api.unsplash.com", "images.unsplash.com"],
    admin: {
      entry: PLUGIN_ADMIN_ENTRYPOINT,
      pages: [{ path: "/", label: "Image Studio", icon: "image" }],
      settingsSchema: {
        unsplashAccessKey: {
          type: "secret",
          label: "Unsplash Access Key",
          description:
            "Your Unsplash application Access Key. Apply at https://unsplash.com/developers. Free tier: 50 requests/hour.",
        },
      },
      fieldWidgets: [
        {
          name: "picker",
          label: "Featured Image Studio",
          fieldTypes: ["image", "file"],
        },
      ],
    },
    routes: {
      "unsplash/search": {
        input: unsplashSearchInput,
        handler: handleUnsplashSearch,
      },
      "unsplash/fetch-bytes": {
        input: unsplashFetchBytesInput,
        handler: handleUnsplashFetchBytes,
      },
      "unsplash/save-attribution": {
        input: saveAttributionInput,
        handler: handleSaveAttribution,
      },
      "unsplash/test-key": {
        handler: handleUnsplashTestKey,
      },
      "unsplash/key-status": {
        handler: handleKeyStatus,
      },
      "unsplash/save-key": {
        input: saveKeyInput,
        handler: handleSaveKey,
      },
      "unsplash/clear-key": {
        handler: handleClearKey,
      },
    },
  };
  return definePlugin(definition);
}

export default createPlugin;
