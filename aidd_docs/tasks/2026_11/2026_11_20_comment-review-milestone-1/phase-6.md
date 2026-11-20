---
status: done
---

# Instruction: Review panel

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/
    └── addon/
        ├── global-top.vue ✏️
        └── components/
            ├── CommentPopover.vue ✅
            ├── StackPanel.vue ✅
            ├── RunStatus.vue ✅
            └── api.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Open the demo deck with the server running | The review panel is visible | browser |
| Happy path   | Select an element, type a note, confirm | The comment appears in the stack panel | browser |
| Happy path   | Press send with several comments | The run status shows running, then finished, and the stack empties | browser |
| Edge case    | Press send with an empty stack | Send is disabled | browser |
| Edge case    | The agent fails | A failure message shows and the stack stays editable | browser |
| Teardown     | Remove every comment | The stack panel is empty | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────┐
│ Slide preview (selected element highlighted)  (1)    │
│        ┌────────────────────────┐                    │
│        │ (2) Comment popover    │                    │
│        │ [ note ........... ]   │                    │
│        │ [Add]                  │                    │
│        └────────────────────────┘                    │
├──────────────────────────────────────────────────────┤
│ (3) Stack: slide 2 · "Intro text" · note   [remove]  │
│           slide 4 · "Install" · note       [remove]  │
│ (4) Run status: idle | running | finished | failed   │
│ (5) [Send stack]                                      │
└──────────────────────────────────────────────────────┘
```

1. Preview: the slide with the hovered or selected element highlighted.
2. Popover: where the author writes the note for the selected element.
3. Stack: the pending comments, each removable until a run starts.
4. Status: what the agent is doing, so the author knows when it is done or failed.
5. Send: one action for the whole stack, disabled when empty or locked.

## Tasks to do

### `1)` Server client

> One thin client for the server routes.

1. Add the client that lists, adds, removes and sends, and follows the run status.

### `2)` Comment popover and stack

> Write a note on the selected element and see the stack grow.

1. Show the popover on selection, and add the comment on confirm.
2. List the stack with a remove control per comment, hidden while locked.

### `3)` Send and status

> Send everything at once and follow the run.

1. Add the send control, disabled when the stack is empty or a run is in progress.
2. Show running, finished and failed.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | The client reflects the server's stack and run status. |
| 2 | A comment added from a selection appears in the stack and can be removed until a run starts. |
| 3 | Send is disabled when empty or locked, and the status shows running then finished or failed. |
