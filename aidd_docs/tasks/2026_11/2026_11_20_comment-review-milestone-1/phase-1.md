---
status: pending
---

# Instruction: Workspace and demo deck

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── package.json ✅
├── pnpm-workspace.yaml ✅
├── tsconfig.json ✅
├── vitest.config.ts ✅
├── .gitignore ✏️
└── examples/
    └── demo-deck/
        ├── package.json ✅
        └── slides.md ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Run `pnpm install` from the project root | Dependencies are installed with no error | cli |
| Happy path   | Start the demo deck with Slidev | The deck serves on a local port and the first slide renders | cli |
| Edge case    | Install fails with a connection reset behind the sandbox proxy | A retry with lower network concurrency completes the install | cli |
| Teardown     | Stop the dev server | No process is left listening | cli |

## Tasks to do

### `1)` Workspace manifest

> One root that installs every package and runs the shared checks.

1. Create the root `package.json` with the `test` and `typecheck` scripts, and `pnpm-workspace.yaml` covering `packages/*` and `examples/*`.
2. Add `tsconfig.json` and `vitest.config.ts` shared by every package.
3. Make sure `.gitignore` already excludes `node_modules/` and add nothing else unless a tool needs it.

### `2)` Reliable install

> Installs must survive the sandbox proxy.

1. Set a lower network concurrency in the root manifest or the documented install command, and note it for `CONTRIBUTING.md`.

### `3)` Demo deck

> A small Slidev deck to review against.

1. Create `examples/demo-deck/package.json` depending on Slidev and its default theme.
2. Write `slides.md` with several slides holding titles, paragraphs, lists and a code block, so selection has varied targets.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `pnpm install` succeeds and `pnpm test` runs with no test and no error. |
| 2 | `pnpm install` completes in the sandbox with the documented setting. |
| 3 | The demo deck starts and shows its slides in the browser. |
