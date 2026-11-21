---
status: done
---

# Instruction: Review stack and server routes

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/
    ├── review/
    │   ├── package.json ✅
    │   └── src/
    │       ├── stack.ts ✅
    │       ├── stack.test.ts ✅
    │       ├── prompt.ts ✅
    │       └── prompt.test.ts ✅
    └── server/
        └── src/
            ├── index.ts ✏️
            ├── routes.ts ✅
            └── routes.test.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Start the server with a fake agent | The routes answer | api |
| Happy path   | Add three comments, list them, remove one | Two remain, in order | api |
| Happy path   | Send the stack | One prompt holding every comment is given to the agent, and run status events are streamed | api |
| Edge case    | Add or remove a comment while a run is in progress | The request is refused because the stack is locked | api |
| Edge case    | Send an empty stack | The request is refused with a clear message | api |
| Edge case    | The agent fails | The stack unlocks and the failure is reported | api |
| Teardown     | Clear the stack | The stack is empty and unlocked | api |

## Tasks to do

### `1)` Stack

> Hold the pending comments and lock them during a run.

1. Keep an ordered stack of validated comments with add, remove and list.
2. Lock the stack while a run is in progress and unlock it when the run ends, whatever the outcome.

### `2)` Prompt builder

> A compact prompt that tells the agent where to look.

1. Group the comments by slide and give each its text excerpt, selector, optional source line and the note.
2. Keep the wording short, with no deck content repeated beyond each excerpt.

### `3)` Routes

> Expose the stack and the run to the preview.

1. Add routes to add, list and remove comments, and to send the stack.
2. Stream the run status to the preview and clear the stack after a successful run.
3. Use the agent interface only, never a CLI directly.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Add, remove and list keep order, and a locked stack refuses changes. |
| 2 | Every comment of the stack appears once in the prompt, grouped by slide. |
| 3 | Sending runs the agent once for the whole stack, streams its status, and unlocks the stack when it ends. |
