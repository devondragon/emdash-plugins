---
"@devondragon/emdash-plugin-featured-image-studio": patch
---

Docs: mark the admin-CSP Unsplash-thumbnail issue ([emdash-cms/emdash#415](https://github.com/emdash-cms/emdash/issues/415)) as fixed upstream. Every published EmDash release (0.16.1+) uses `img-src 'self' https: data: blob:`, so Unsplash thumbnails render with no worker CSP patching. The previous "Known issue" section is replaced with a compatibility note; the old workaround is retained in a collapsed `<details>` for pre-0.16 pre-release builds only.
