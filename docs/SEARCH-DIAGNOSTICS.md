# Search connection diagnostics

The reported message is thrown at the outbound request try/catch, before HTML parsing. Its cause is not yet known. This patch adds classified error codes and a request reference, without changing the provider, request headers, redirect policy or timeout.

Codes: SEARCH_RUNTIME_ERROR (prepare), SEARCH_TIMEOUT, SEARCH_REDIRECT_ERROR, SEARCH_DNS_ERROR, SEARCH_TLS_ERROR and SEARCH_NETWORK_ERROR. Classification uses exception names, known message patterns and an allowlist of native cause codes; it is a diagnostic hint, not proof of the upstream root cause.

Custom console warnings contain reference ID, stage, classified code, elapsed time, safe exception name and optional allowlisted cause code. They do not log raw error messages, query text, request URLs, tokens or headers. Cloudflare invocation logging is a separate platform setting and may record URLs.

After deployment, reproduce once and inspect Workers & Pages > goooooook > Logs > Live, or run npx wrangler tail goooooook. Match youtube-search-source events by the reference displayed in the UI. Do not blindly follow redirects or retry around source limits. This change does not claim the connection problem is resolved.

Progress: request stage located; 7 new mocked diagnostic tests passed; live root cause and source connectivity remain unverified. The approved CI workflow tests and requests the existing production D1 deployment. No database SQL changes are introduced.
