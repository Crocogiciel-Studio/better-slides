---
status: pending
---

# Instruction: Addon shell and server hook

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── packages/
│   ├── addon/
│   │   ├── package.json ✅
│   │   ├── global-top.vue ✅
│   │   └── setup/
│   │       └── vite-plugins.ts ✅
│   └── server/
│       ├── package.json ✅
│       └── src/
│           ├── index.ts ✅
│           └── index.test.ts ✅
└── examples/
    └── demo-deck/
        ├── package.json ✏️
        └── slides.md ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Start the demo deck with the addon enabled | The preview serves | cli |
| Happy path   | Request the ping route of the server | It answers with a success status and a small JSON body | api |
| Happy path   | Open the preview | A visible marker from the addon's global layer appears above the slides | browser |
| Edge case    | Request an unknown route | The deck's own routes still work and the server answers not found | api |
| Teardown     | Stop the dev server | No process is left listening | cli |

## Tasks to do

### `1)` Server router

> A router that mounts inside Slidev's Vite server, with one ping route.

1. Create the `server` package exporting a function that returns Vite middleware.
2. Answer a ping route with a JSON status, and pass every other request on.
3. Cover both behaviors with a test.

### `2)` Addon shell

> One addon that brings both the server hook and a global layer.

1. Create the `addon` package and its `setup/vite-plugins.ts` that mounts the server middleware.
2. Add `global-top.vue` that renders a small marker above the slides.
3. Enable the addon from the demo deck's front matter and dependencies.
4. If one addon cannot ship the hook and the layer together, record the finding and split them, keeping the same behavior.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | The ping route answers with a success status, and an unknown route is not captured. |
| 2 | The marker is visible in the preview and the ping route answers on the deck's own port. |
