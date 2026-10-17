# No-key keyword search progress

Implemented: when the Worker has no YOUTUBE_API_KEY, /api/music/search uses the no-key YouTube search-page adapter after the existing room authorization and rate limits. /api/music/unified keeps automatic input routing and the existing cards, preview, favorites, queue and MV/KTV options. When a Google key is configured, official search remains selected. Direct-video oEmbed and official playlist paths are unchanged.

The adapter reads ytInitialData as JSON only; it never evaluates downloaded JavaScript. Queries are encoded, outbound URL is fixed, redirects are rejected, timeout is 8 seconds, body is bounded to 4 MiB, results are deduplicated and capped at 20, confirmed live/upcoming entries are skipped, and durations support hours. Successful responses are cached 5 minutes per isolate. Existing per-actor and daily request limits still apply. Source 403/429 triggers a 60-second cooldown; there is no challenge bypass or automatic retry loop.

Current limit: first batch only; no continuation-page fetching for this no-key source. Metadata does not verify embed, age, region, SafeSearch or MV/KTV audio format. The adapter depends on the current page structure. Deployment and source access must still be checked; platform permissions/terms should be reviewed before public production use.

| Item | Status |
| --- | --- |
| No-key keyword adapter | Code prepared |
| Unified card integration | Uses existing UI and result schema |
| MV/KTV search preference | Preserved; title-based labels |
| Authentication/rate limits/cache | Implemented |
| Local tests | 27 new unit/route checks passed with fixtures and mocked services |
| Live YouTube/Cloudflare acceptance | Not completed |
| Push | Awaiting approval |
| Deployment | Requested only after approved push and CI tests pass; completion not yet verified |

Run node --test test/youtube-page-search.test.mjs. The existing cloud/music-install.test.mjs also invokes this new suite. NO_KEY_SEARCH_ENABLED=false disables the no-key source. No new secret or dependency is required. The approved deployment workflow will execute the existing production D1 migration and Worker deployment; no SQL changes are introduced in this commit.
