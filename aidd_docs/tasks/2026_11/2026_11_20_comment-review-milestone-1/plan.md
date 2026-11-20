---
objective: "A Slidev author can select slide elements, stack comments, and send them at once to their local coding agent, which edits the deck so the preview updates."
status: implemented
---

# Plan: Better Slide milestone 1, comment-based review

Source: `aidd_docs/tasks/2026_11/2026_11_20_comment-review-milestone-1/spec.md`

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Workspace and demo deck | [`phase-1.md`](./phase-1.md) | none |
| 2   | Addon shell and server hook | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Element selection and comment payload | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Agent layer | [`phase-4.md`](./phase-4.md) | 1 |
| 5   | Review stack and server routes | [`phase-5.md`](./phase-5.md) | 2, 3, 4 |
| 6   | Review panel | [`phase-6.md`](./phase-6.md) | 5 |
| 7   | End to end and documentation | [`phase-7.md`](./phase-7.md) | 6 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://www.npmjs.com/package/@slidev/cli | Installed version 53.1.0 and read its published files: the `setup/vite-plugins.ts` hook is loaded from every root including addons, `global-top` and `global-bottom` layers exist, and rendered slides carry `data-slidev-no`. |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| Runtime | Observed: Slidev 53.1.0 installs and exposes the hooks above, Node 22, pnpm 12.21.0 (installed with npm, because the Corepack download came out incomplete) and the Claude Code CLI 2.1.329 are present. Unverified: that one addon can ship both a `vite-plugins.ts` hook and a global layer, that a rendered element can be tied to its source line, and the CLI's headless output while logged in. Observed: installs over the sandbox proxy failed with `ECONNRESET` or came out incomplete until concurrency was lowered. | 1, 2, 3, 4 |
| Regression | None: the repository holds no code yet. | none |
| Architecture | Starts from the modular local monolith in `aidd_docs/INSTALL.md`. Creates the `addon`, `server`, `review`, `agents` and `shared` packages and keeps the rule that only the agent adapters know the AI CLIs. | 1, 2, 4, 5 |
| Documentation | Checked: `testing.md`, `coding-assertions.md` and `codebase-map.md` are minimal stubs written before any code. `README.md`, `aidd_docs/INSTALL.md`, `CONTRIBUTING.md` and the project memory (`testing.md`, `coding-assertions.md`, `codebase-map.md`) change once code and commands exist. | 7 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `aidd_docs/memory/architecture.md` constraints | Strip `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from the agent environment, never touch CLI credentials, and keep CLI knowledge in the adapters. |
| `aidd_docs/memory/vcs.md` | Conventional commits without a `Co-Authored-By` trailer, commit after each phase, merge by rebase. |
| Docs in English | Every document written by the plan is in English. |

## Decisions

| Decision | Why |
| -------- | --- |
| Hono serves the routes | `architecture.md` leaves Hono or Fastify open. Hono is small and fits Vite middleware. |
| Vitest runs the tests | It is Vite-native, like Slidev, and needs little setup in a pnpm workspace. |
| The two measured spike outcomes are recorded as decision records in `aidd_docs/memory/internal/decisions/` | The element-to-source link and the headless CLI behavior shape later work and would be costly to rediscover. |
