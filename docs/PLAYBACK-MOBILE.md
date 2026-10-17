# Playback and mobile acceptance

Run `node --test test/room-autoplay.test.cjs test/frontend-sync.test.cjs` in the repository root. New tests execute the actual room-upgrade module with mocked DOM, player, and API. CI runs tests only; this change does not dispatch a deployment or change D1.

The phone UI uses the supplied deep-purple/neon references: six bottom tabs, song cards, cyan search, green play, yellow restart and pink next. Mobile/coarse-pointer layouts hide and disable TV launch; direct TV URLs redirect to studio remote. TV playback still runs on a separate desktop. This is visual adaptation, not implementation of search categories or insertion features shown only in the references.

The TV attempts loadVideoById for an unpaused new song. There is no artificial initial authorization gate. Browser denial sets blocked=true and shows the local button; polls and new queue heads do not keep trying. A local click retries; observed PLAYING clears blocked. Native YouTube play is observed too. Playback success is not a permanent browser permission grant.

ENDED is accepted only for the video and queue item actually observed playing, on the current leader, while unpaused. The request captures that item id and shares the existing advancing guard with manual next. Legacy seen is cleared on PLAYING to avoid two independent ended handlers. Duplicate ends after a failed request do not blindly retry; use manual next. Old-epoch replies are ignored.

Browser acceptance (not executed by Node tests):
1. Use a fresh browser profile on the desktop TV. Queue two embeddable videos without first clicking inside the TV page. Autoplay may succeed if browser policy allows; do not require every browser to block.
2. When genuinely blocked, check `goKtvPlaybackStatus()` in TV DevTools: blocked must be true. Heartbeat report.blocked must be true and no repeated play attempts should occur on polling.
3. Click the TV local button or native YouTube play. On PLAYING, blocked is false and playedItem matches current. Wait for natural end: Network must show one /api/queue/next request carrying the finished item's id, then load the next video.
4. Pause the room, add songs, and verify no playback. Lose the TV lease and verify the old TV pauses.
5. At phone widths and on coarse-pointer devices, confirm no TV-launch button, all six tabs visible, no horizontal page overflow and usable controls. Open a TV URL on the phone and confirm redirect to remote.
6. Calling goKtvBlocked() manually tests UI behavior only, not actual browser autoplay policy. Node mocks do not validate real iframe audio, D1 or deployment.
