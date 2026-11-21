---
status: pending
---

# Instruction: Agent feedback per comment

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/
    ├── shared/
    │   └── src/
    │       ├── comment.ts ✏️
    │       └── run.ts ✏️
    ├── review/
    │   └── src/
    │       ├── prompt.ts ✏️
    │       ├── prompt.test.ts ✏️
    │       ├── stack.ts ✏️
    │       ├── stack.test.ts ✏️
    │       ├── report.ts ✅
    │       └── report.test.ts ✅
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
        │   ├── RunStatus.vue ✏️
        │   ├── api.ts ✏️
        │   └── reviewState.ts ✏️
        └── e2e/
            └── review-ui.e2e.test.ts ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Stack three comments on two slides, with a stand-in agent that reports on each | Each comment shows waiting | browser |
| Happy path   | Send the stack | The comment being handled shows in progress, the footer shows the comment number and the current activity, such as editing `slides.md` | browser |
| Happy path   | The run ends | Each comment shows done with the agent's one-line reply, and they stay until the author clears the finished ones | browser |
| Edge case    | The agent reports one comment as not done | That comment shows not done with the reason and stays in the stack for the next send | browser |
| Edge case    | The agent never prints a report marker | Every comment ends with a clear state, and the agent's final text is shown as a fallback | system |
| Edge case    | A note contains text that looks like a report marker | The marker in the note has no effect on any state | system |
| Edge case    | The agent fails or is cancelled mid-run | Handled comments keep their state, the others show failed or back to waiting, and nothing stays in progress | browser |
| Teardown     | Clear the finished comments | Only the comments still to send remain | browser |

## Wireframe

```txt
┌───────────────────────────────────────┬────────────────────────┐
│                                       │ (1) Review         [x] │
│                                       │ SLIDE 2                │
│        Slide area                     │ ┌────────────────────┐ │
│        resized, never covered         │ │ "Why review"       │ │
│                                       │ │ Shorter title      │ │
│                                       │ │ (2) ✓ Done         │ │
│                                       │ │ (3) ↳ Shortened to │ │
│                                       │ │   "Why comments"   │ │
│                                       │ └────────────────────┘ │
│                                       │ SLIDE 4                │
│                                       │ ┌────────────────────┐ │
│                                       │ │ "pnpm install"     │ │
│                                       │ │ (2) ⟳ In progress  │ │
│                                       │ └────────────────────┘ │
│                                       ├────────────────────────┤
│                                       │ (4) Editing slides.md  │
│                                       │ Comment 2 of 3 [Cancel]│
│                                       │ (5) [Clear finished]   │
└───────────────────────────────────────┴────────────────────────┘
```

1. Sidebar: unchanged layout, still resizing the slide.
2. State: waiting, in progress, done, not done or failed, per comment.
3. Reply: the agent's one-line answer, kept after the run.
4. Activity: what the agent is doing now and which comment it is on.
5. Clear finished: removes the done comments, keeps the rest for the next send.

## Tasks to do

### `1)` Report protocol

> The agent says which comment it handles and how it went, cheaply.

1. Give each comment a short stable id, and ask the agent in the prompt to print a start marker and a one-line outcome marker per comment, done or not done with a reason.
2. Parse markers from the agent's text only, never from the note, the excerpt or the selector, so a note cannot fake a state.
3. At the end of a run, close every comment that got no outcome with a clear state, and keep the agent's final text as a fallback reply.

### `2)` Activity from the CLI

> Show what the agent does without spending tokens.

1. Turn the CLI's file read and edit events into generic activity events in the adapter, without naming the CLI outside `packages/agents`.
2. Stream comment states and activity to the preview.

### `3)` Stack after a run

> Keep the outcome visible.

1. Keep done comments with their reply until the author clears them, and put not done and failed comments back in the stack for the next send.
2. On cancel or failure, leave no comment in progress.

### `4)` Sidebar feedback

> Make the run readable.

1. Show the state and the reply on each comment card, the current activity and the comment number in the footer, and a control to clear the finished comments.
2. Keep the keyboard on the deck after every new control, and keep the layout checks of phase 8 passing.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Markers in the agent's text update the right comment, markers inside a note change nothing, and a comment never reported on ends in a clear state. |
| 2 | Reading or editing a file during a run shows as activity in the preview, and only `packages/agents` names the CLI. |
| 3 | After a run, done comments keep their reply until cleared, and not done or failed ones are sent again next time. |
| 4 | In Chromium, a run shows in progress then done with a reply on each card, the footer shows the activity, and the arrow keys still navigate. |
