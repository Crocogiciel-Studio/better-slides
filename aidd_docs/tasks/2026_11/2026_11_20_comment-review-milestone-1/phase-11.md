---
status: done
---

# Instruction: Selection improvements

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/
    ├── shared/
    │   └── src/
    │       ├── comment.ts ✏️
    │       └── comment.test.ts ✏️
    ├── review/
    │   └── src/
    │       ├── prompt.ts ✏️
    │       └── prompt.test.ts ✏️
    ├── server/
    │   └── src/
    │       └── routes.ts ✏️
    └── addon/
        ├── global-top.vue ✏️
        ├── components/
        │   ├── ReviewComposer.vue ✏️
        │   ├── ReviewSidebar.vue ✏️
        │   ├── reviewState.ts ✏️
        │   ├── selection.ts ✏️
        │   └── selection.test.ts ✏️
        └── e2e/
            └── review-ui.e2e.test.ts ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Open review mode on slide 2 at 1280x720 | The sidebar is open and the slide is resized | browser |
| Happy path   | Click an element | The note field has the focus, and the arrow keys move the cursor without changing the slide | browser |
| Happy path   | Press Escape, or Add, or Cancel | The focus is back on the deck and the right arrow changes the slide | browser |
| Happy path   | Click an empty area of the slide | The whole slide is outlined, the composer says whole slide with the note focused, and the slide did not change | browser |
| Happy path   | Press the Whole slide control, write a note, Add | The card reads "Slide 2 · whole slide" | browser |
| Edge case    | Type a note, then click another element | The typed text stays and the target becomes the new element | browser |
| Edge case    | Send a whole-slide comment | The prompt says the note applies to the whole slide and keeps its report id | system |
| Edge case    | Post a whole-slide comment with no text or selector, or an over-long note | Accepted, then refused with the field named | api |
| Teardown     | Remove the comments and leave review mode | Baseline restored | browser |

## Wireframe

```txt
┌────────────────────────┐
│ Review             [x] │
│ (1) Slide 2            │
│     Whole slide        │
│ ┌────────────────────┐ │
│ │ (2) |              │ │
│ └────────────────────┘ │
│ [Add] [Cancel] (3)[Whole slide] │
├────────────────────────┤
│ SLIDE 2                │
│ (4) Slide 2 · whole    │
│     slide · note       │
└────────────────────────┘
```

1. Target: the element's text, or "Whole slide".
2. Note field: focused as soon as something is selected.
3. Whole slide: targets the current slide, also shown when nothing is selected.
4. Card: a whole-slide comment says so instead of an element excerpt.

## Tasks to do

### `1)` Focus the note on select

> The author types at once after selecting.

1. Focus the note field, without scrolling, when an element or the slide is selected.
2. Keep the typed text when another target is selected, and give the focus back to the deck on Escape, Add and Cancel.

### `2)` Comment on the whole slide

> Some feedback is about the slide, not one element.

1. Add a target kind to the comment, element or slide, where a slide target needs no text or selector and keeps the slide and note rules.
2. Select the whole slide on a click on an empty area of the slide, without changing slide, and with a Whole slide control; outline the slide while it is selected.
3. Say in the prompt that the note applies to the whole slide, with its report id, and show it on the card.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | In Chromium, selecting focuses the note and the arrows do not change slide; after Escape, Add or Cancel the focus is on the deck and the arrows change slide; a second selection keeps the typed text. |
| 2 | A whole-slide comment is accepted without text or selector, its prompt line says whole slide, and in Chromium both ways of selecting it leave the slide unchanged and show "whole slide" on the card. |
