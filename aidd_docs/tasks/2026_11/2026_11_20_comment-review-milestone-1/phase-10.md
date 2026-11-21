---
status: done
---

# Instruction: Agent readiness

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/
    ├── shared/
    │   └── src/
    │       └── run.ts ✏️
    ├── agents/
    │   ├── src/
    │   │   ├── agent.ts ✏️
    │   │   └── adapters/
    │   │       ├── claude-code.ts ✏️
    │   │       └── claude-code.test.ts ✏️
    │   └── test/
    │       └── fixtures/
    │           └── fake-claude.mjs ✏️
    ├── server/
    │   └── src/
    │       ├── routes.ts ✏️
    │       └── routes.test.ts ✏️
    └── addon/
        ├── components/
        │   ├── ReviewSidebar.vue ✏️
        │   ├── api.ts ✏️
        │   └── reviewState.ts ✏️
        └── e2e/
            └── review-ui.e2e.test.ts ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Open review mode with a stand-in agent that reports a logged-in subscription | The sidebar says the agent is ready and Send is enabled | browser |
| Happy path   | Send a stack | The server checks readiness again, then runs the agent | api |
| Edge case    | The agent reports it is not logged in | Send is disabled and the sidebar says to run `claude` then `/login` | browser |
| Edge case    | The agent is not installed | The sidebar says it was not found and Send is disabled | api |
| Edge case    | The agent would bill an API key or another provider | The sidebar says it uses API billing, not the subscription, and Send is disabled | api |
| Edge case    | The readiness check prints malformed output or times out | The state is unknown, Send stays enabled, and a run-time failure is still handled | api |
| Edge case    | A run fails with an authentication error | The failure says to log in again, the comments go back to waiting, and readiness is checked again | api |
| Edge case    | The author logs in and presses Check again | The sidebar says ready and Send is enabled, with the keyboard still on the deck | browser |
| Teardown     | Restore the logged-in stand-in | Baseline restored | system |

## Wireframe

```txt
┌────────────────────────┐
│ (1) Not logged in: run │
│ `claude` then `/login` │
│        [Check again]   │
│ [Send stack (3)] (off) │
└────────────────────────┘
```

1. Readiness: one line near Send, with a control to check again.

## Tasks to do

### `1)` Readiness in the agent layer

> Know before sending whether the agent can run on the author's subscription.

1. Add an optional readiness check to the agent interface, with a generic result: ready or not, a reason and a hint.
2. In the Claude Code adapter, read the CLI's login status with the same safe environment and command lookup, keep only the fields needed, and map them to the generic result without ever throwing.

### `2)` Readiness in the server

> Never start a run that is bound to fail on login.

1. Serve the readiness, cached briefly and refreshed on demand.
2. Check again right before a send and refuse it when the agent is not ready.
3. When a run fails on authentication, report it as such, put its comments back to waiting, and drop the cached readiness.

### `3)` Readiness in the sidebar

> The author sees why Send is off and how to fix it.

1. Show the readiness near Send, disable Send when not ready, and offer a check again control that keeps the keyboard on the deck.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Logged in, logged out, API key, malformed output, timeout and not installed each map to the right readiness, and no account field leaves the adapter. |
| 2 | Send is refused when the agent is not ready, and an authentication failure puts the comments back to waiting and refreshes readiness. |
| 3 | In Chromium, a logged-out agent disables Send and shows the login hint, Check again restores it, and the arrow keys still navigate. |
