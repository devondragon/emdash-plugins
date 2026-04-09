/**
 * Admin bundle entry — loaded by EmDash via the plugin descriptor's
 * `adminEntry` module specifier. Exposes pages (route → component) and
 * field widgets (widget name → component) per the `PluginAdminExports`
 * contract described in the EmDash plugin API.
 */

import type { PluginAdminExports } from "emdash";

import { FieldWidget } from "./ui/FieldWidget.js";
import { StudioPage } from "./ui/StudioPage.js";

export const pages: PluginAdminExports["pages"] = {
  "/": StudioPage,
};

export const fields: PluginAdminExports["fields"] = {
  picker: FieldWidget,
};
