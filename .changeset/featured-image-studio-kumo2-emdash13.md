---
"@devondragon/emdash-plugin-featured-image-studio": minor
---

Support EmDash 1.x and @cloudflare/kumo 2. Peer ranges are now `emdash >=1.0.1` and `@cloudflare/kumo ^2.6.0` (the version EmDash 1.3 ships), which removes the `missing peer @cloudflare/kumo@^1.0.0` warning. The field widget now stores the same image/file value object as EmDash's built-in editors (`{ id, provider, alt, width, height, filename, mimeType, meta.storageKey }`) instead of a bare media ID, and reads the 1.x widget `label` prop. Thumbnails for previously stored ID strings are rehydrated from the media API's `storageKey`. Both text inputs gain an `aria-label`, which kumo 2 warns about when missing.
