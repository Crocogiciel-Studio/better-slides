# Testing

## Commands

- `pnpm test`: Vitest over `packages/*/src/**/*.test.ts` and `packages/*/components/**/*.test.ts`. No real CLI, login or browser needed.
- `pnpm typecheck`: `vue-tsc --noEmit` over the packages, the `.vue` files (script and template) and `fake-claude.mjs` (`checkJs`). Not covered: `examples/demo-deck/` (a Markdown deck, no TypeScript). Slidev's own virtual modules are not typed, and the addon imports none.

## Conventions

- A change with code ships with its test, and both commands pass before a pull request opens.
- Agent tests use `packages/agents/test/fixtures/fake-claude.mjs`, a stand-in CLI that prints stream-json events (text, `Read`/`Edit` tool calls on `slides.md`, report markers per comment id, a final result). It answers `auth status --json` from `FAKE_CLAUDE_AUTH_FILE` or `FAKE_CLAUDE_AUTH` (logged in by default, `HANG` never answers). Driven by env variables (delay, `FAKE_CLAUDE_STEP_MS` per comment, failure, file edits) and keywords in the prompt or a note (`AUTH_FAIL`, `SKIP`, `CRASH`, `HOLD`, `NOREPORT`, `ECHO`, `SPLIT`, `HANG`, `FAIL`). Never send a prompt to the real CLI in a test: it spends the user's subscription.
- DOM code (`addon/components/selection.test.ts`) runs under `happy-dom` through a `@vitest-environment` comment.
- `packages/server/src/end-to-end.test.ts` drives comment, stack and send with the real adapter and the fake CLI, and checks that no API-key variable reaches the agent.
- `addon/components/reviewState.test.ts` covers the review state, the slide grouping and the play-mode check without a browser.
- `addon/e2e/review-ui.e2e.test.ts` drives real Chromium through `playwright-core` against two Slidev servers it starts (ports 3131 and 3132, the stand-in CLI via `BETTER_SLIDE_TEST`): toggle inside the bar, sidebar and slide rectangles never intersect at 1280x720, 1920x1080 and 1024x640 in light and dark, arrow keys after every review interaction (selecting focuses the note, where the arrows do not change slide; Escape, Add and Cancel give them back), whole-slide comments by a background click and by the control in light and dark, presenter, overview, plain Slidev, and a run with the stand-in (`FAKE_CLAUDE_STEP_MS=600`): one comment in progress with the activity and the counter, then done and not done with replies, Clear finished, the no-marker fallback, a mid-run crash, a logged-out agent that disables Send until Check again, and a login failure at run time. It skips with a warning when no Chromium is found (set `BETTER_SLIDE_CHROMIUM`) and saves screenshots to `BETTER_SLIDE_SCREENSHOTS` (default: the OS temp folder). Look at the screenshots; the assertions alone missed the poor UI of the first round.
- Hot reload after a run is not covered by an automated test; it was checked by hand.
