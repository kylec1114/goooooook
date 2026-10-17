# Feature progress and integration boundaries

This commit contains implementation, not proof of production success.

| Feature | Code | Validation still required |
| --- | --- | --- |
| Music package | Pinned 5.0.4; URL-classification subpath only | Actual npm installation, bundle and license inspection |
| Safe YouTube search | Official API, strict search, exact-host validation, rate/budget limits | Worker YOUTUBE_API_KEY and real API tests |
| Metadata and playlist preview | Implemented with pagination and explicit selection | Browser and real playlist tests |
| Version/status | Real BUILD_COMMIT plus Worker metadata; null if absent | Check deployed status against Actions commit |
| Invite QR/copy | Authenticated QR, password-free links, visitor hint | Real browser/room acceptance |
| Guest reset/revocation | Owner controls, confirmation, generated new guest password | Verify old/new guest sessions on separate browsers |
| Queue ordering | Uses previously committed pending-only sorting and conflicts | Real concurrent device acceptance |
| Other providers | Safe URL classification only | Official metadata/search not implemented |

Do not call package 5.0.4 the latest: registry latest could not be verified. The reviewed repository declares MPL 2.0, while CDN metadata labels ISC; inspect the installed LICENSE and preserve applicable notices before redistribution. No upstream source is modified. Raw YouTube scraping and stream extraction are disabled by design.

GitHub Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Worker Secret: YOUTUBE_API_KEY. Never expose these in public files or chat. Non-secret options: YOUTUBE_REGION (HK by default), MUSIC_DAILY_REQUEST_LIMIT (80 upstream requests/day by default). BUILD_COMMIT is injected from GITHUB_SHA. CF_VERSION_METADATA is a binding, not a secret.

This exact commit message can trigger the updated D1 workflow when the workflow file changes on main. It installs without lifecycle scripts, runs existing/new tests and a real installed-package smoke check, migrates D1, validates the bundle and deploys. These steps can fail; commit success is not deployment success. Existing GitHub Secrets cannot be inspected by this assistant. Missing YOUTUBE_API_KEY disables official search without scraping fallback.

Local tests use mocked upstream API responses. No real browser, real D1 or audio acceptance has been completed. SafeSearch is a filter, not a child-safety guarantee. In-memory metadata cache is per isolate and lasts 10 minutes.
