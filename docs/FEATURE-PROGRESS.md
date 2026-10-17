# YouTube-only unified search progress

This update supersedes the earlier multi-platform package plan. Only YouTube is enabled for music search/playback selection. The @kamkam1_0/music-search dependency is removed; the compatibility adapter remains a local YouTube-only URL checker. Existing room, invitation, guest management, status and playback layers are preserved.

## One input

GET /api/music/unified?input=...&mode=all|mv|ktv&pageToken=...

Text searches automatically; YouTube video links resolve the original video; playlist links preview playlist items. A watch URL containing both v and list defaults to the video. Bare youtube.com/watch URLs are supported. Other platforms are rejected. Mode adds search terms for text only, not audio conversion for pasted links.

MV/KTV labels are title-based candidates, never verified vocal/stem information. Results offer inline preview, single queue addition, favorites, and checkbox batch addition. The old search forms are hidden; existing local favorites search moves to the Favorites page. Newer responses replace older searches; abort/timeout and room-switch checks prevent stale search rendering.

## Sources and secrets

YouTube official API code exists. Actual Worker YOUTUBE_API_KEY configuration could not be read in this session because /api/status retrieval failed. Do not claim it is configured or functional. The status endpoint reports only a configuration boolean, not the key and not a successful API test. No Spotify, Deezer or SoundCloud provider is enabled. The same Cloudflare deploy credentials and existing D1 bindings remain.

## Errors

| Case | Behavior/code |
| --- | --- |
| Empty/too long/control characters | 400 INVALID_INPUT or INPUT_TOO_LONG |
| Invalid format preference | 400 INVALID_MODE |
| Invalid, HTTP, credentialed or spoofed URL | 400 INVALID_YOUTUBE_URL |
| Other music platform link | 400 UNSUPPORTED_SOURCE |
| Page token for a direct video | 400 INVALID_PAGE_TOKEN |
| Not logged in | 401 LOGIN_REQUIRED |
| Room expired | 410 ROOM_EXPIRED |
| Permission denied | 403 FORBIDDEN |
| Missing YouTube key | 503 SEARCH_NOT_CONFIGURED |
| API denial/key restriction/quota | UPSTREAM_DENIED; the current upstream adapter does not distinguish all causes |
| Local rate/daily budget limit | 429 RATE_LIMITED |
| Video filtered/private/deleted/unavailable | 404 VIDEO_UNAVAILABLE; reason is not inferred beyond returned metadata |
| No search results/empty playlist | Successful empty result with an explicit message |
| Network, timeout, non-JSON response | Visible retry/error message, never a fake successful result |
| Duplicate song/full queue | Existing queue errors, batch reports successful and skipped counts |
| Room changes mid-request/batch | Ignore old response or stop the batch |
| Sorting revision conflict | Existing 409 handling and refresh remains |

## Tests and deployment

26 new local unit/middleware tests pass with mocked upstream service; they are not browser, real YouTube API, D1 or audio tests. The existing cloud/music-install.test.mjs script runs the YouTube-only compatibility checks and invokes test/unified-search.test.mjs, so the current D1 workflow will run these checks when manually executed. This update itself does not trigger the path-filtered deployment workflow. Actual npm install/bundle, browser acceptance and production deployment remain pending.
