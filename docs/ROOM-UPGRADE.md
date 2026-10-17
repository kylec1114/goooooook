# Playback and control upgrade

This patch uses cloud/room-worker.mjs as middleware around the existing cloud/worker.mjs. It preserves existing API authorization and room-expiry behavior. Run the updated cloud/migration.sql before serving the new Worker. The existing D1 Setup and Deploy Web workflow already executes that file.

Implemented: root redirect preserving room query; strict-origin-when-cross-origin for the new player; locked room navigation; a single Studio remote; pending-only queue sorting; iframe-container fullscreen; default native captions; next-song information; local first-play button; TV telemetry with server-checked revision acknowledgements; stale/offline reporting; website controls for the local extension engine.

Command confirmation is state convergence reported by the active TV, not proof that the user heard audio. Last-write-wins controls can supersede earlier commands. Polling is still used, not a low-latency WebSocket transport. TV reports become stale after 12 seconds; lease behavior remains the original backend's.

Human acceptance remains required: actual YouTube embedding/autoplay, browser fullscreen, device audio, Chrome extension capture, deployment and real D1 concurrent operations. Local mocks and SQLite checks do not replace these tests. Extension must be reloaded after changing content.js; capture still starts via its popup on the TV computer. No independent YouTube vocal stem is exposed.

Run: node --test test/room-protocol.test.mjs test/room-worker.test.mjs
Run existing tests too: node --test test/frontend-sync.test.cjs; node cloud/permissions.test.mjs

## KTV lyrics: separate data-dependent feature
Native captions stay at fontSize 0. Word-by-word KTV highlighting is not implemented in this patch. It requires authorized lyric text plus word/syllable timestamps, a video-to-lyrics mapping and timing-offset controls. Line-only LRC does not guarantee word-level timing. Never claim arbitrary YouTube captions can be downloaded without authorization.

## Deploy
Review the migration, commit all files together, then manually run D1 Setup and Deploy Web on main. This patch does not automatically dispatch deployment. The workflow's existing syntax/permission checks do not automatically run the two new tests unless separately invoked. Do not claim production success until the deployment logs and real device acceptance are checked.
