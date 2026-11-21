# Codebase Map

## Areas

- `aidd_docs/`: project memory, the install guide, and decision records in `memory/internal/decisions/`.
- `.github/`: issue and pull request templates, and Dependabot configuration.
- `examples/demo-deck/`: Slidev deck with the addon enabled.

## Packages

| Package | Role |
| ------- | ---- |
| `packages/shared` | Comment type (an element, or the whole slide), validation and excerpt; run types: comment states, activity, run status, the snapshot the server streams. |
| `packages/agents` | `Agent` interface and generic events (`text`, `activity`, `finished`, `failed`), safe environment and login-shell lookup, Claude Code adapter that maps the CLI's stream-json and its `auth status` to a generic readiness. Only place that knows a CLI. |
| `packages/review` | Comment stack with lock and per-comment states (`stack.ts`), prompt builder, report-marker reader (`report.ts`), best-effort source-line locator. |
| `packages/server` | Hono routes (`/__better-slide/*`) mounted as Vite middleware: comments, clear finished, agent readiness (`/agent`, cached 30 s), send (refused when the agent is not ready), cancel, status, events (a snapshot of status and comment states on every change). |
| `packages/addon` | Slidev addon: `setup/vite-plugins.ts` mounts the server, `custom-nav-controls.vue` puts the review toggle in Slidev's bar, `global-top.vue` teleports the sidebar to `<body>` and narrows `#page-root` (review mode only, play view only), `components/` hold `reviewState` (shared state, grouping, focus release), `ReviewToggle`, `ReviewSidebar`, `ReviewComposer`, `RunStatus` and `selection` (element or whole-slide picks, hover and selected outlines); `e2e/review-ui.e2e.test.ts` is the Chromium test. |

## Flow

Preview selection -> `addon/components` -> HTTP `/__better-slide` -> `server` -> `review` prompt -> `agents` -> CLI edits `slides.md` -> Slidev hot reload.
