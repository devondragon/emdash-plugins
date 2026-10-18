---
"@devondragon/emdash-plugin-404-viewer": minor
---

Support EmDash 1.3 and `@cloudflare/kumo` 2.x. The `@cloudflare/kumo` peer is now `^2.6.0` (the version EmDash 1.x ships), which removes the `missing peer @cloudflare/kumo@^1.0.0` warning, and the `emdash` peer floor is now `>=1.0.0`.

Also fixes two admin UI bugs: "Load more" in the full log view never appeared because the plugin read `cursor` instead of the API's `nextCursor`, and the "→ Redirect" buttons were hidden from admins because the role check required level 80 while EmDash's admin role is 50.
