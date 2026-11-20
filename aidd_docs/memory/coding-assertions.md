# Coding Assertions

## Prerequisites

- Node 22 and pnpm 12. Install with `pnpm install` (low network concurrency is set in `pnpm-workspace.yaml`).
- No hook runs before a commit or a push yet.

## Assertions

- `pnpm typecheck` and `pnpm test` pass.
- Only `packages/agents` names an AI CLI (tests excepted). Other packages use the `Agent` interface.
- The agent child environment never holds an `ANTHROPIC_*`, `OPENAI_*` or `CLAUDE_CODE_USE_*` variable (`buildAgentEnv`).
- No code reads, stores, logs or returns CLI credentials.
- Better Slide opens no network connection of its own: the only `fetch` is the same-origin client in `addon/components/api.ts`.
- Packages are TypeScript ES modules that import with explicit `.ts` extensions.
- Review UI elements carry `data-better-slide-ui` so selection ignores them.
