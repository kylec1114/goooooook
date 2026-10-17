# Unified search: no-key direct video metadata

This update removes the unconditional Google key requirement for a direct YouTube video URL. The existing room authorization, per-actor rate limit, unified UI and Google request budget remain in place.

Routing:
- Direct video, no Google key: fixed YouTube oEmbed JSON endpoint for title/channel/thumbnail/canonical URL.
- Direct video, Google key: try detailed official metadata; on source request failure, downgrade to basic oEmbed with an explicit notice.
- Known age/region/embed filtering from a successful official response: do not fall back around that filter.
- Text: official search when configured. Otherwise return SEARCH_NOT_CONFIGURED and a safe external YouTube search URL; the UI offers that link so the user can paste a video URL back.
- Playlist: official API key is still required; no hidden scraping fallback.

Basic metadata has durationSeconds=null, embeddable=null, restrictionsVerified=false and playbackVerified=false. The UI says duration awaits player loading; it does not invent zero seconds. No raw oEmbed html is used. A successful basic lookup is not a playback, SafeSearch, age or regional eligibility verification.

Outbound metadata requests only target https://www.youtube.com/oembed with a validated canonical video URL; redirects are rejected, timeout is 8 seconds, response text is limited to 100000 characters, and successful metadata is cached for 10 minutes per isolate with up to 200 entries.

18 new mocked local tests passed. Actual YouTube endpoint availability, browser behavior and production deployment are not verified. The existing cloud/music-install.test.mjs now runs the previous unified tests plus the new basic-metadata tests during the D1 workflow. This commit does not itself trigger that path-filtered deployment workflow. No package dependency or Wrangler binding changes are required.
