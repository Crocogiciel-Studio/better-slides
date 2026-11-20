---
status: pending
---

# Instruction: Agent layer

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/
│   └── memory/
│       └── internal/
│           └── decisions/
│               └── 0002-agent-headless-launch.md ✅
└── packages/
    └── agents/
        ├── package.json ✅
        ├── src/
        │   ├── agent.ts ✅
        │   ├── environment.ts ✅
        │   ├── environment.test.ts ✅
        │   └── adapters/
        │       ├── claude-code.ts ✅
        │       └── claude-code.test.ts ✅
        └── test/
            └── fixtures/
                └── fake-claude.mjs ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Point the adapter at a fake CLI script | The adapter uses it instead of the real CLI | system |
| Happy path   | Run a prompt through the adapter | Events arrive in order: running, then finished | system |
| Happy path   | Build the child environment from one holding both API-key variables | Neither variable is present in the result | system |
| Edge case    | The CLI exits with an error | A failed event carries the reason | system |
| Edge case    | The CLI is not found | A failed event says it is missing, with no crash | system |
| Edge case    | Launched with a minimal environment | The CLI path is still resolved through a login shell | system |
| Teardown     | Cancel a run | The child process is stopped | system |

## Tasks to do

### `1)` Agent contract

> One interface that hides which CLI runs.

1. Define the agent interface: run a prompt in a working folder and emit running, finished and failed events.
2. Keep every CLI-specific detail out of the interface.

### `2)` Safe environment

> The CLI must bill the subscription, never the API.

1. Build the child environment from the parent's, removing `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
2. Resolve the CLI's location through a login shell, because a GUI-launched process lacks the shell `PATH`.
3. Read, store and log no credential.

### `3)` Claude Code adapter

> Launch the user's installed CLI headless and stream its progress.

1. Spawn the CLI in non-interactive mode in the deck's folder, and map its output to the agent events.
2. Support cancelling a run.
3. Test it against a fake CLI script so the suite needs no real login.

### `4)` Decision record

> Keep what the real CLI does when launched headless.

1. Run one minimal prompt against the real CLI with the safe environment, once, and note the output format and the login state seen.
2. Write `0002-agent-headless-launch.md` with that outcome, saying plainly what could not be verified.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | The interface names no CLI and a second adapter could implement it unchanged. |
| 2 | The built environment contains neither API-key variable, and a minimal environment still finds the CLI. |
| 3 | A fake CLI run yields running then finished, an erroring one yields failed, and a cancel stops the process. |
| 4 | The decision record states what the real CLI printed and what remains unverified. |
