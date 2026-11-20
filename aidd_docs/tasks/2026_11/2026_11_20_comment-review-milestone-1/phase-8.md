---
status: pending
---

# Instruction: Integrated review interface

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/
    └── addon/
        ├── custom-nav-controls.vue ✅
        ├── global-top.vue ✏️
        ├── components/
        │   ├── ReviewToggle.vue ✅
        │   ├── ReviewSidebar.vue ✅
        │   ├── ReviewComposer.vue ✅
        │   ├── reviewState.ts ✅
        │   ├── reviewState.test.ts ✅
        │   ├── CommentPopover.vue ❌
        │   ├── StackPanel.vue ❌
        │   └── RunStatus.vue ✏️
        └── e2e/
            └── review-ui.e2e.test.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Open the demo deck in Chromium at 1280x720, light mode | The Slidev navigation bar shows a review toggle among its own buttons, and no floating card covers the slide | browser |
| Happy path   | Press the toggle | A sidebar appears on the right, the slide area gets narrower, and the sidebar rectangle and the slide rectangle do not intersect | browser |
| Happy path   | Click an element, type a note, add it | The comment appears in the sidebar with its whole note, grouped under its slide, and the toggle shows the pending count | browser |
| Happy path   | After each of toggle, select, add, remove, send and cancel, press the right arrow key | The slide changes each time, so keyboard focus is never lost | browser |
| Edge case    | Type a note and press the arrow keys inside the note field | The text cursor moves and the slide does not change, then Escape returns the focus to the deck | browser |
| Edge case    | Add twenty comments with long notes | The sidebar scrolls inside itself, nothing is cut off, and the slide area keeps its size | browser |
| Edge case    | Resize the window to 1920x1080 and to 1024x640, and switch to dark mode | The layout holds with no overlap, and the sidebar follows the Slidev theme | browser |
| Edge case    | Open the presenter view and the overview | No review toggle breaks them | browser |
| Teardown     | Turn review mode off | The sidebar disappears and the slide area returns to full width | browser |

## Wireframe

```txt
┌───────────────────────────────────────┬───────────────────────┐
│                                       │ (3) Review        [x] │
│        (1) Slide area                 │ (4) Selected element  │
│        resized, never covered         │     "Install" + note  │
│                                       │     [Add] [Cancel]    │
│                                       ├───────────────────────┤
│                                       │ (5) Slide 2           │
│                                       │   "Intro" · full note │
│                                       │ Slide 4               │
│                                       │   "Install" · note    │
│                                       ├───────────────────────┤
│                                       │ (6) Agent: idle       │
│ (2) Slidev bar: ← → ▦ ☀ ... [💬 2]   │ (7) [Send stack]      │
└───────────────────────────────────────┴───────────────────────┘
```

1. Slide area: the real Slidev canvas, resized when the sidebar is open and never overlapped.
2. Slidev navigation bar: the review toggle sits among the native buttons, with the pending count.
3. Sidebar header: title and a close control.
4. Composer: the selected element and the note field, inside the sidebar, not over the slide.
5. Stack: the pending comments grouped by slide, each note shown in full with a remove control.
6. Status: the agent state, with a cancel control while it runs.
7. Send: one action for the whole stack.

## Tasks to do

### `1)` Toggle in the Slidev bar

> The review control belongs to Slidev's own navigation bar.

1. Add `custom-nav-controls.vue` so Slidev renders the toggle inside its bar, in the style of its native buttons, with a count of pending comments and an active state.
2. Show it in play mode only, so presenter and overview keep working.
3. Remove the floating card from `global-top.vue`.

### `2)` Sidebar that makes room

> The slide canvas must shrink, not be covered.

1. Add a sidebar docked on the right, using the page layout mechanism Slidev already uses for its own side editor, so the canvas resizes.
2. Move the composer, the stack and the status into it, and delete the popover and the old stack panel.
3. Group comments by slide, wrap whole notes, and scroll inside the sidebar when the stack grows.
4. Follow Slidev's light and dark theme with its own styling helpers.

### `3)` Keyboard stays on the deck

> Navigation by keyboard must survive every interaction.

1. Return the focus to the deck after every review button press, and make Escape leave a note field.
2. Keep element selection from swallowing the deck's own click and key handling.
3. Let the arrow keys edit text while a note field is focused, and navigate otherwise.

### `4)` Browser tests in the repository

> The checks that failed the author by hand become tests.

1. Add Chromium tests that assert the toggle is inside the Slidev bar, the layout rectangles do not intersect, the keyboard keeps working after each interaction, and a screenshot is saved for each layout case.
2. Skip them with a clear message when Chromium is absent, so `pnpm test` never fails on a machine without it.
3. Look at the saved screenshots before calling the phase done.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | The toggle is a child of the Slidev navigation bar, shows the pending count, and no floating card remains. |
| 2 | With review mode on, the slide rectangle and the sidebar rectangle do not intersect at 1280x720, 1920x1080 and 1024x640, in light and dark mode. |
| 3 | The right arrow changes the slide after toggle, select, add, remove, send and cancel, and does not while typing in a note. |
| 4 | The browser tests pass with Chromium, skip cleanly without it, and their screenshots show a readable, uncovered slide. |
