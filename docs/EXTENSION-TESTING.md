# Extension real-device acceptance checklist

Status: checklist only. This document is not evidence that real Chrome/audio tests passed.

## Install or update

1. Download the current repository and keep the complete extension directory, including manifest.json, background.js, popup.html, popup.js, offscreen.html, offscreen.js and content.js.
2. Use desktop Chrome 116 or later. Open chrome://extensions, enable Developer mode, and choose Load unpacked. Select extension, not the repository root.
3. If already installed, replace the local files and click Reload on the extension card. Reload the TV website afterward so the new content script runs.
4. Current allowed website origins: https://goooooook.kylechan051114.workers.dev and http://localhost:3000. Other origins are intentionally rejected.

## Test capture on the TV computer

1. Open /studio.html, log in to a test room, open the new TV screen and first confirm an embeddable video plays normally with audio.
2. Keep that TV tab active, open the extension popup and click Start. Capture must begin through the extension popup, not silently from the web page.
3. Verify the popup reports capture active for this tab. In the injected web panel click Check audio status and verify it agrees.
4. Move strength from 0 toward 100. At 0 the dry stereo signal should remain; stronger center cancellation can reduce centered vocals and instruments. Mono content can become silent. This is not AI source separation.
5. Click Stop and restore. Verify capture ends and ordinary tab audio returns. Start again to check reacquisition.
6. Close or reload the captured tab and verify the extension can start on a fresh tab.
7. Try a second goooooook tab: it must not take over another active capture without stopping it first. A non-owner tab must not stop or adjust another tab's capture.
8. A phone cannot operate audio captured on another computer through this local extension bridge.

## Debugging and evidence

Open chrome://extensions and inspect Errors and the background service worker. Also inspect the TV page Console. Close DevTools and repeat the test, since DevTools can affect worker lifetime.

Record Chrome version, extension version, tested commit, TV URL without credentials, operating system, steps, expected/actual behavior and redacted error text. Never include passwords, Authorization headers or room tokens.

## Existing automated tests

Run from repository root: node --test test/frontend-sync.test.cjs

These tests exercise extracted frontend control functions with a fake backend/player. They do not prove real browser, Cloudflare D1, audio or cross-device behavior.
