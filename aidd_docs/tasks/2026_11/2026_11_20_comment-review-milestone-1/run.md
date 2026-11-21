# Run: Better Slide milestone 1, comment-based review

## Run 1

- Head: `6f98d60`
- Left: no real Claude Code run (fake CLI only); the browser flow was checked by hand with headless Chromium, not by an automated test; `pnpm test` has no browser test; the plain-Slidev check and the no-network check were manual.

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | `pnpm install`, `pnpm test` | install ok, test exits 0 with no test |
| 1.2 | `pnpm install` with workspace concurrency setting | completes; packages complete |
| 1.3 | `slidev` on demo deck, curl | HTTP 200, process killed after |
| 2.1 | server vitest: ping, unknown route | 200 JSON, 404 under prefix, others pass on |
| 2.2 | dev server ping + headless Chromium marker | ping 200 on deck port, addon layer rendered |
| 3.1 | shared vitest | valid accepted, invalid rejected naming field |
| 3.2 | Chromium hover/click on slide 2 and code block | highlight, payload with slide/text/selector, listeners removed |
| 3.3 | decision record 0001 | states observed outcome and shipped precision |
| 4.1 | agents vitest | interface names no CLI |
| 4.2 | environment vitest | no API-key variable; login-shell lookup with empty PATH |
| 4.3 | adapter vitest with fake CLI | running/finished, failed, missing, cancel stops |
| 4.4 | `claude --help`, `--version` only | record 0002 written, real run unverified |
| 5.1 | stack vitest | order kept, lock refuses changes |
| 5.2 | prompt vitest | each comment once, grouped by slide |
| 5.3 | routes vitest + live POST | one run per stack, status streamed, unlock at end, line hint exact |
| 6.1 | api vitest | client reflects stack and status |
| 6.2 | Chromium on demo deck, fake agent | comment added, removed until run starts |
| 6.3 | Chromium on demo deck, fake agent | send disabled empty/locked; running then finished or failed |
| 7.1 | end-to-end vitest | deck edited, no API-key variable reached agent |
| 7.2 | plain Slidev copy; /proc net check; grep | opens without addon; same single proxy connection with and without addon; only same-origin fetch |
| 7.3 | docs; `pnpm typecheck`; `pnpm test` | both exit 0, 50 tests pass (at `85cb4ee`; the later fixes are in Run 2) |

## Run 2 (review repairs)

- Head: `07769c0`. `pnpm typecheck` exit 0 (`vue-tsc`); `pnpm test` exit 0, 11 files, 76 tests.
- Browser: headless Chromium over Playwright against `slidev` on the demo deck, with the stand-in CLI (`BETTER_SLIDE_TEST=1`, `BETTER_SLIDE_FAKE_AGENT`), `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` set in the server environment. By hand, not an automated test.

| Behaviour | Validation | Result |
| --------- | ---------- | ------ |
| Select, comment, stack | click Comment, click slide 2 `h1`, write note, Add | highlight on hover, one item in the panel, Send disabled while empty |
| Send and status | Send stack | status `running: working`, Cancel shown, remove buttons gone, Send disabled |
| Hot reload | stand-in CLI edits `slides.md` | status `finished`, `h1` changed without a reload, stack emptied |
| Lock | POST a comment during the run | 423 |
| Cancel | send a `HANG` comment, click Cancel | status `failed: cancelled`, stack kept and unlocked, remove buttons back, Send enabled, Cancel hidden |
| Line hint | comment on a paragraph | server filled `line: 16`, the right line |
| Guard | foreign `Origin`; `text/plain` POST | 403; 415 |
| Loopback-only | request through `[::1]` (Host not in the list) | 403; `127.0.0.1` was not reachable (Slidev binds `localhost`) |
| Body and length limits | 100 KB body; 3000-character note | 413; 400 |
| Environment stripping | stand-in CLI writes its variable names | no `ANTHROPIC_*` or `OPENAI_*` name, test variable present |
| Fake-agent switch | demo started with `BETTER_SLIDE_TEST=1` and `BETTER_SLIDE_FAKE_AGENT` | the stand-in ran; the unit test shows no effect without the switch |
| Workspace recipe | README steps with a temporary `examples/my-deck`, `slidev` on 3057 | API ping `{"ok":true}`, panel rendered, no page error; folder deleted after |
| Plain Slidev without the addon | temporary deck with no addon, port 3058 | `h1` rendered, no panel, no page error; `/__better-slide/ping` returned the SPA HTML, not the API; folder deleted after |
| SIGKILL escalation, run timeout, throwing agent, `is_error`, cancel before spawn, bash `-i -c`, command-name check, prompt forging, `--host` refusal | vitest only | pass in the 76 tests |

Not checked in a browser: the run timeout and the SIGKILL escalation (vitest with the stand-in only), the shell lookup with a real zsh or bash and a real `claude`, `--host` serving (refusal is pinned by a Host-header test, not by starting Slidev with `--host`), a deck split over several files, any second browser or the Slidev presenter and overview modes. A real Claude Code run with a login was never made: no prompt was sent to the real CLI.

## Run 3 (integrated review interface, phase 8)

- Head: `5a04c90` (code and browser test); `1c9db3f` adds docs only. `pnpm typecheck` exit 0; `pnpm test` exit 0, 13 files, 94 tests (including 11 Chromium tests and 7 `reviewState` tests).
- Browser: real Chromium 1255 through `playwright-core` 1.65.1, two Slidev servers started by the test (3131 with the stand-in CLI via `BETTER_SLIDE_TEST=1`, 3132 plain deck without the addon). No prompt was sent to the real CLI. Screenshots (45) viewed one by one for 1280x720, 1920x1080 and 1024x640, light and dark, in these states: initial, review on, element selected with a note typed, 3 comments, 20 long comments, agent running, agent failed.

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1 | `nav [data-testid=toggle]` exists, bar hidden until hover then opacity 1, no `[data-testid=panel]`, count badge shows 3 | pass |
| 2 | `#slide-container.right <= sidebar.left` in every state at 3 sizes x 2 themes; slide narrower than without the sidebar; 20 comments: slide width unchanged, stack scrolls inside, no clipped note; sidebar background `rgb(18,18,18)` dark, `rgb(255,255,255)` light; close restores the full width | pass |
| 3 | after toggle, select, Escape in the note field, add, remove, add with Enter, send, cancel, close: focus on BODY and ArrowRight then ArrowLeft change the slide; a click on the selected element does not advance; ArrowLeft/Right inside the note move the caret, not the slide | pass |
| 4 | presenter (no toggle, no sidebar, `r` ignored) and overview: no console error or page error; plain Slidev: no toggle, ArrowRight works, no error | pass |

Not checked: a real Claude Code run; Slidev other than 53.1.0; hash router mode and a non-root `base` (the play-mode check handles `base` in a unit test only); touch devices; the Chromium test skip path (written with `describe.skipIf`, not exercised because Chromium is installed here); the reload of the deck after a successful run with the sidebar open (verified by hand in Run 2 with the old UI only); screen readers; zoom other than 100 %. The Slidev bar wraps to two rows at 1024x640 with the sidebar open and the review button lands alone on the top row (Slidev's own wrapping, accepted).

## Run 4

- Head: `56a4183`
- Left: no real Claude Code run (stand-in CLI only, no prompt sent to `claude`); the stream-json event shapes and the report markers are unverified against the real CLI; `claude auth status --json` was run once read-only to see its field names (only `loggedIn`, `authMethod`, `apiProvider`, `loginExpiresAt` read; account fields never printed); the `authMethod` values for API-key or console logins are guessed; the docs commits `af4a341` and the plan, run and assert files came after the checks, docs only. Commits between code phases do not each typecheck on their own (the shared types change first).

`pnpm typecheck` exit 0; `pnpm test` exit 0, 14 files, 168 tests. `packages/addon/e2e/review-ui.e2e.test.ts` run three times in a row: 18/18 passed each time, exit 0, 65.9 s, 66.1 s, 65.1 s. No process left listening on 3030, 3131 or 3132. Screenshots viewed one by one under the scratchpad `ux/phase9`, `ux/phase10`, `ux/phase11` folders (during and after a run, no-marker fallback, mid-run crash, not logged in, API billing, login failure, whole slide selected, autofocused composer; 1280x720 and 1024x640, light and dark).

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | not re-run on its own; `pnpm install` and `pnpm test` at `56a4183` | pass |
| 1.2 | `pnpm install --network-concurrency=4 --force` (needed: missing native rollup binding) | completes |
| 1.3 | the Chromium test starts `slidev` on the demo deck | serves |
| 2.1 | `packages/server/src/index.test.ts` | pass |
| 2.2 | Chromium test: addon layer and toggle rendered | pass |
| 3.1 | `packages/shared/src/comment.test.ts` | pass |
| 3.2 | `selection.test.ts` and the Chromium test | pass |
| 3.3 | decision 0001, updated with whole-slide comments | written |
| 4.1 | `packages/agents` tests | pass |
| 4.2 | `environment.test.ts`, and the readiness check's env test | no provider variable reaches the CLI |
| 4.3 | `claude-code.test.ts` with the stand-in | pass |
| 4.4 | decision 0002 updated (event mapping, readiness), still unverified against a real run | written |
| 5.1 | `stack.test.ts` | pass |
| 5.2 | `prompt.test.ts` | pass |
| 5.3 | `routes.test.ts`, `end-to-end.test.ts` | pass |
| 6.1 | `api.test.ts` | pass |
| 6.2 | Chromium test | pass |
| 6.3 | Chromium test | pass |
| 7.1 | `end-to-end.test.ts` | deck edited, no API-key variable reached the agent |
| 7.2 | assertion greps (see assert round 4) | no match |
| 7.3 | `pnpm typecheck`, `pnpm test` | exit 0, 168 tests |
| 8.1 | Chromium: toggle inside `nav` | pass, 3 runs |
| 8.2 | Chromium: no overlap at 3 sizes x 2 themes | pass, 3 runs |
| 8.3 | Chromium: keyboard after every interaction (now with autofocus on select) | pass, 3 runs |
| 8.4 | Chromium: presenter, overview, plain Slidev | pass, 3 runs |
| 9.1 | `report.test.ts` (normal, interleaved, split at every position, unknown id, duplicates, no markers, neutralised note) and `routes.test.ts` (marker in a note echoed by the agent changes nothing) | pass |
| 9.2 | `claude-code.test.ts` mapping and tolerance; `routes.test.ts` snapshot stream; Chromium shows "Reading/Editing slides.md" and "Comment N of 3" | pass |
| 9.3 | `stack.test.ts` after done, skipped, failed, cancel; Chromium: Clear finished keeps the not done comment, Send shows (1) | pass |
| 9.4 | Chromium: in progress then done, not done with replies; no-marker fallback "Unconfirmed"; mid-run crash `done, failed, waiting`; arrow keys after the run and after Clear finished; screenshots viewed | pass |
| 10.1 | `claude-code.test.ts`: logged in, logged out, API key, other provider, malformed, timeout, not installed, stripped env, no account field returned | pass |
| 10.2 | `routes.test.ts`: 30 s cache and refresh, send refused with 409, login failure puts comments back to waiting and re-checks | pass |
| 10.3 | Chromium: logged-out stand-in disables Send with the hint, Check again restores it, arrows work; login failure at run time; screenshots viewed | pass |
| 11.1 | Chromium: note focused after select and after the Whole slide control, ArrowRight does not change slide; a second selection keeps the typed note; Escape, Add, Cancel give the keys back; sidebar rectangle unchanged by autofocus | pass |
| 11.2 | `comment.test.ts`, `prompt.test.ts`, `routes.test.ts`, `selection.test.ts`; Chromium: background click and control select the whole slide, slide unchanged, outline shown, card "Slide 2 · whole slide", light and dark | pass |
