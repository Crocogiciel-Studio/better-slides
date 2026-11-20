# Testing

## Commands

- `pnpm test`: Vitest over `packages/*/src/**/*.test.ts` and `packages/*/components/**/*.test.ts`. No real CLI, login or browser needed.
- `pnpm typecheck`: `tsc --noEmit` over the packages.

## Conventions

- A change with code ships with its test, and both commands pass before a pull request opens.
- Agent tests use `packages/agents/test/fixtures/fake-claude.mjs`, a stand-in CLI driven by env variables (delay, failure, file edits). Never send a prompt to the real CLI in a test: it spends the user's subscription.
- DOM code (`addon/components/selection.test.ts`) runs under `happy-dom` through a `@vitest-environment` comment.
- `packages/server/src/end-to-end.test.ts` drives comment, stack and send with the real adapter and the fake CLI, and checks that no API-key variable reaches the agent.
- Browser behavior (panel, popover, hot reload) has no automated test. It was checked by hand with headless Chromium driven over CDP.
