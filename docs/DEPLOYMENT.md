# Manual deployment and production verification

## Deploy from GitHub

Open https://github.com/kylec1114/goooooook/actions/workflows/d1-setup-deploy.yml
Select Run workflow, choose main, and click Run workflow. Open the new run, then open the deploy job.

Review each step: Cloudflare secrets check; Worker dependency installation; Wrangler installation; syntax checks; API permission and expiry test; original schema initialization; room-runtime migration; Worker dry-run; website deployment.

This workflow writes to the production D1 database using schema.sql and cloud/migration.sql, then deploys the Worker. Inspect these files before running. Never paste Cloudflare secret values into logs, chat or issues.

The UI tests workflow is separate: https://github.com/kylec1114/goooooook/actions/workflows/ui-tests-dispatch.yml
Its success only means its own steps passed and the deployment dispatch was accepted, not that the subsequent D1 deployment completed.

## GitHub CLI alternative

    gh workflow run d1-setup-deploy.yml --repo kylec1114/goooooook --ref main
    gh run list --repo kylec1114/goooooook --workflow d1-setup-deploy.yml --limit 5
    gh run watch RUN_ID --repo kylec1114/goooooook
    gh run view RUN_ID --repo kylec1114/goooooook --log-failed

Replace RUN_ID with the real run ID. CLI login and appropriate repository access are required.

## Check website after deployment

    curl -I https://goooooook.kylechan051114.workers.dev/
    curl -IL https://goooooook.kylechan051114.workers.dev/
    curl -I https://goooooook.kylechan051114.workers.dev/studio.html

After the redirect change is deployed, / should return a 302 to /studio.html, which may be normalized to a clean URL by static-asset routing. Follow the Location chain and confirm the final page contains the new Studio UI. Verify room-code query parameters still reach the join form; do not assume this solely from a successful redirect.

The public/_redirects rule is applied by the static assets service. It does not replace the Worker API router or apply to arbitrary Worker-generated responses. The current Worker delegates non-API requests to env.ASSETS.fetch. This file alone does not trigger the existing path-filtered test/deploy workflow; run the D1 workflow manually after pushing.

## Cloudflare runtime logs

Cloudflare dashboard: Workers & Pages > goooooook > Logs > Live. Navigation labels may vary. Start the live stream, then reproduce the failing request.

From an authenticated local project checkout:

    npx wrangler tail goooooook

Observe status, exceptions and console.error output while loading Studio and testing an isolated room. Live logs show new events while connected; absence of a current error is not proof of no historical errors. Do not share credentials or Authorization headers.

## Acceptance boundaries

A green GitHub deployment is not proof that D1-backed room controls work. Verify login, guest permissions, queue, TV heartbeat, play/pause/restart/next, volume and lease takeover on separate devices. A static homepage response does not validate D1. No real-device or production pass is claimed by this document.
