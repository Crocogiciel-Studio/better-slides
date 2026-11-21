---
status: done
---

# Instruction: Element selection and comment payload

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/
│   └── memory/
│       └── internal/
│           └── decisions/
│               └── 0001-element-source-link.md ✅
└── packages/
    ├── shared/
    │   ├── package.json ✅
    │   └── src/
    │       ├── comment.ts ✅
    │       └── comment.test.ts ✅
    └── addon/
        ├── global-top.vue ✏️
        └── components/
            ├── selection.ts ✅
            └── selection.test.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Open the demo deck with selection mode on | Hovering an element highlights it | browser |
| Happy path   | Click a paragraph on slide 2 | A payload is produced with slide 2, the element's text and a selector | browser |
| Happy path   | Validate a well-formed payload | It is accepted | system |
| Edge case    | Click an element inside a code block or a click-animated element | The payload still identifies the slide and text | browser |
| Edge case    | Validate a payload with no slide or an empty text | It is rejected with the missing field named | system |
| Teardown     | Leave selection mode | The highlight and listeners are removed | browser |

## Tasks to do

### `1)` Comment payload

> One shared, validated shape for a comment.

1. Create the `shared` package with the comment type: slide number, element text excerpt, selector, optional source line, and the author's note.
2. Validate it and reject a payload missing the slide or the note.
3. Keep the text excerpt short, so a stack stays cheap to send.

### `2)` Selection

> Pick an element in the preview and turn it into a payload.

1. Add a selection mode to the addon that highlights the hovered element and captures a click.
2. Read the slide number from the slide container and build the selector and text excerpt from the element.
3. Try to attach the exact source line through the addon's hooks, and fall back to slide, text and selector when it is not available.

### `3)` Decision record

> Keep the measured outcome of the element-to-source spike.

1. Write `0001-element-source-link.md` stating what was tried, what was observed, and which level of precision the product ships.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | A valid payload is accepted and each invalid one is rejected with the field named. |
| 2 | Clicking an element produces a payload with its slide, a short text and a selector, even for a code block. |
| 3 | The decision record states the observed outcome and the precision the product ships. |
