---
status: pending
---

# Instruction: End to end and documentation

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── README.md ✏️
├── CONTRIBUTING.md ✏️
├── aidd_docs/
│   ├── INSTALL.md ✏️
│   └── memory/
│       ├── testing.md ✏️
│       ├── coding-assertions.md ✏️
│       └── codebase-map.md ✏️
└── packages/
    └── server/
        └── src/
            └── end-to-end.test.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Start the demo deck with the fake agent that edits `slides.md` | The preview is up | cli |
| Happy path   | Comment two elements, send the stack | The fake agent edits `slides.md` and the preview shows the changes with no manual reload | browser |
| Happy path   | Inspect the agent's environment during the run | No API-key variable is present | system |
| Edge case    | Open the edited deck in plain Slidev | It opens normally | cli |
| Teardown     | Restore the demo deck | `slides.md` is back to its original content | system |

## Tasks to do

### `1)` End-to-end test

> Prove the whole loop with a fake agent.

1. Add a test that drives comment, stack and send against a fake agent that edits the deck.
2. Assert that no credential and no API-key variable is read, stored or shown.

### `2)` Plain Slidev and local-only checks

> Prove two guarantees the spec makes.

1. Remove the addon from a copy of the reviewed deck and check that it opens and runs in plain Slidev.
2. Check that Better Slide opens no network connection of its own: only the agent CLI may reach out.

### `3)` Documentation

> Make the docs match what now exists.

1. Update `README.md` to say what works, and `aidd_docs/INSTALL.md` where the decisions changed, with the two decision records as evidence.
2. Add the proxy install gotcha and the real commands to `CONTRIBUTING.md`.
3. Fill `testing.md`, `coding-assertions.md` and `codebase-map.md` with the real commands, layers and packages.
4. Run the contributor checks the project now requires: `pnpm typecheck` and `pnpm test`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | The end-to-end test passes, and no API-key variable reaches the agent. |
| 2 | The deck opens in plain Slidev without the addon, and Better Slide makes no network call of its own. |
| 3 | The docs name real commands that run, and `pnpm typecheck` and `pnpm test` pass. |
