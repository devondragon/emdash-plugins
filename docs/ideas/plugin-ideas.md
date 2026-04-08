# EmDash Plugin Ideas

A running catalog of plugin ideas for `@devondragon/emdash-plugin-*`. Tags:

- **[P]** personal utility (Devon's own sites)
- **[C]** community reach (broadly useful to most EmDash users)
- **[S]** showcase / ecosystem seeding

## Content authoring & AI

1. **ai-writing-assistant** [P/C/S] — Workers AI in the editor: rewrite, expand, shorten, tone-shift, grammar, SEO title/meta suggestions, alt-text generation. Bring-your-own-key fallback (OpenAI/Anthropic/Groq) for users who want stronger models.
2. **ai-content-review** [P/C] — On save/publish: readability score, tone consistency, broken-link check, fact-flagging ("this claim needs a citation"), duplicate-content detector against your own archive.
3. **featured-image-studio** [P/C/S] — Unsplash/Pexels/Openverse search + import, plus generation via Workers AI (Flux/SDXL), OpenAI Images, Replicate, fal.ai. Auto-crop to variants, auto alt-text, license metadata stored.
4. **ai-translator** [C/S] — One-click translate a post into N locales using Workers AI or BYOK. Stores translations as linked variants.
5. **smart-excerpts** [C] — Auto-generate excerpts, social card copy, and newsletter blurbs from post body.

## SEO / AEO / GEO & discovery

6. **seo-aeo-geo-toolkit** [C] — Traditional SEO *plus* Answer Engine Optimization and Generative Engine Optimization. Meta tags, Open Graph, Twitter cards, JSON-LD schema (Article/BreadcrumbList/FAQ/HowTo/Person/Organization), sitemap.xml, robots.txt, canonical URLs — and on top of that: AEO-friendly Q&A blocks, summary/TL;DR sections, `llms.txt` generation, structured "answer box" content hints, citation-friendly markup, and GEO signals (entity clarity, author credentials, freshness metadata) to help LLM-based search surface the content. Probably the single most-installed plugin you could ship.
7. **redirects-manager** [P/C] — Pairs with 404-viewer: click a 404 → create a redirect. Bulk import/export, regex support, hit counters.
8. **rss-atom-feeds** [C] — Proper feeds per category/tag/author, JSON Feed, WebSub/PubSubHubbub ping.
9. **indexnow-pinger** [C] — Ping Bing/Yandex/Seznam on publish via IndexNow protocol. Tiny, high-leverage.

## Media & assets

10. **image-optimizer** [C] — Pipe uploads through Cloudflare Images or `/cdn-cgi/image/`, responsive `srcset`, AVIF/WebP, LQIP blur placeholders.
11. **media-library-tags** [P] — Tagging, search, reuse-tracking for the media library.
12. **oembed-embeds** [C] — YouTube/Vimeo/Twitter/Bluesky/Mastodon/CodePen embeds with privacy-friendly lazy loading.

## Engagement & community

13. **comments-lite** [C/S] — D1-backed comments with Turnstile, webmentions support, email notifications via Resend/MailChannels.
14. **webmentions** [P/S] — Send + receive webmentions, display on posts. IndieWeb catnip.
15. **newsletter-bridge** [C] — Publish post → send to Buttondown/Beehiiv/Resend Broadcasts/Mailchimp. BYO provider.
16. **reactions** [C] — Lightweight emoji reactions with KV/D1 counts.

## Forms & workflow

17. **contact-forms** [C] — Form builder with Turnstile, submissions stored in D1, email relay, webhook out, spam scoring (optionally AI-assisted).
18. **scheduled-publishing** [P/C] — Cron-trigger based scheduling, with a queue view.
19. **editorial-workflow** [S] — Draft → review → approved → published states, assignees, comments per draft.
20. **revision-history** [P/C] — Diff viewer between revisions, restore, author attribution.

## Analytics & ops

21. **privacy-analytics** [C/S] — Cookieless pageview/referrer/UTM tracking to D1 or Analytics Engine. Admin dashboard.
22. **link-checker** [P] — Crawl published content for broken internal/external links on a schedule.
23. **uptime-pinger** [P] — Ping your own site + dependencies, log failures, surface in admin.
24. **backup-exporter** [P/C] — Export all content + media to R2 / GitHub / Zenodo on a schedule.
25. **audit-log** [S] — Who changed what, when. Important once multi-author.

## Developer / power-user

26. **webhooks-outbound** [C/S] — Fire webhooks on content events (published/updated/deleted). Plays well with Zapier/n8n/self-hosted.
27. **api-tokens** [S] — Scoped API tokens for headless use.
28. **ab-testing** [S] — Split-test headlines/hero images using Workers KV, pick winner by CTR.
29. **feature-flags** [P/S] — Per-post or per-section flags for staged rollouts.
30. **wordpress-importer-plus** [C] — Note: EmDash already ships a built-in WordPress importer. This plugin would either *improve* that importer or offer a better alternative, focused on the rough edges: robust image/media import (download, dedupe, re-host to R2/Cloudflare Images, rewrite URLs in post bodies), correct original post date and timezone handling, author mapping, category/tag reconciliation, redirect generation for changed slugs, shortcode/Gutenberg block conversion, and resumable imports for large sites. Gateway drug for WP refugees — could single-handedly drive adoption.
31. **import-from-ghost / markdown / hugo / jekyll** [C] — Same idea, different sources.

## Fun / showcase

32. **reading-time + progress bar** [C] — Tiny, ubiquitous.
33. **table-of-contents** [C] — Auto-generated from headings with scroll-spy.
34. **code-playground-embeds** [S] — StackBlitz/CodeSandbox/Shiki syntax highlighting at build time.
35. **giscus-comments** [C] — GitHub Discussions-backed comments (trivial to build, very popular).

---

## Sequencing notes

- **Immediate personal win + pairs with existing plugin**: `redirects-manager` (closes the loop with 404-viewer).
- **Biggest community magnet**: `seo-aeo-geo-toolkit` and `wordpress-importer-plus` — these bring users to EmDash itself.
- **Stated interests, highest showcase value**: `ai-writing-assistant` + `featured-image-studio`.
- **Sleeper hit**: `webmentions` — small code, big IndieWeb goodwill.
