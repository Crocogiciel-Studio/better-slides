# Codebase Map

## Areas

- `aidd_docs/`: project memory, the install guide, and decision records in `memory/internal/decisions/`.
- `.github/`: issue and pull request templates, and Dependabot configuration.
- `examples/demo-deck/`: Slidev deck with the addon enabled.

## Packages

| Package | Role |
| ------- | ---- |
| `packages/shared` | Comment type, validation and excerpt. |
| `packages/agents` | `Agent` interface, safe environment and login-shell lookup, Claude Code adapter. Only place that knows a CLI. |
| `packages/review` | Comment stack with lock, prompt builder, best-effort source-line locator. |
| `packages/server` | Hono routes (`/__better-slide/*`) mounted as Vite middleware: comments, send, status, events. |
| `packages/addon` | Slidev addon: `setup/vite-plugins.ts` mounts the server, `global-top.vue` and `components/` hold selection, popover, stack and status. |

## Flow

Preview selection -> `addon/components` -> HTTP `/__better-slide` -> `server` -> `review` prompt -> `agents` -> CLI edits `slides.md` -> Slidev hot reload.
