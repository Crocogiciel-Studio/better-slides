# Project Brief

## Purpose

- Better Slide adds a comment-based review loop and a coding agent on top of Slidev decks.
- Without it, a reviewer must describe in prose which slide element to change, which wastes tokens and drifts.

## Users

- Slidev author: builds a deck and reviews it slide by slide.
- Contributor: maintains this open source repository.

## Main journey

1. Open a deck with Better Slide.
2. Browse the slides, select an element, write a comment.
3. Keep stacking comments through the whole deck.
4. Send the stack to the coding agent.
5. The agent edits `slides.md` and Slidev hot reload updates the preview.

## Domain language

| Term | Meaning |
| --- | --- |
| Deck | A regular Slidev project, whose source of truth is its `slides.md`. |
| Comment stack | The structured comments a reviewer accumulates before sending them all at once. |
| Agent | The Claude Code or Codex CLI already installed and logged in on the user's machine. |
| Review | One pass of commenting, sending the stack, and checking the agent's edits. |

## Business rules

- The agent runs on the user's own subscription, never on the billed API.
- Better Slide never reads, copies or stores the credentials of the AI CLIs.
- A deck stays a regular Slidev project, usable without Better Slide.
- Comments are structured so the agent fixes them without exploring the deck.

## Out of scope

- Manual editing directly on the slide.
- A desktop app.
- A hosted or multi-user version.
