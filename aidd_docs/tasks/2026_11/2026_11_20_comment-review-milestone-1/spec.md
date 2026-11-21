# Better Slide - Milestone 1: comment-based review

## Target

A Slidev author can review a running deck by attaching comments to slide elements, stacking them, and sending the whole stack at once to their locally installed coding agent, which edits the deck source so the preview shows the changes.

## Hard constraints

- The agent runs on the user's own subscription: no API-key setting reaches the agent during a run, so nothing is billed to an API.
- Better Slide never reads, copies, stores, displays or transmits the credentials of the coding agent.
- A deck stays a regular Slidev project: it opens and runs without Better Slide afterwards.
- Everything runs on the author's machine, with no account and no hosted service.
- Each comment carries enough information for the agent to locate its target without exploring the deck: the slide, and what identifies the selected element.
- One send carries the whole stack, never one comment at a time.
- The agent is found and runs even when Better Slide was not started from the author's interactive shell.
- When an element cannot be tied to its exact line in the deck source, its comment carries the slide, the element's text and a selector instead.
- The stack is locked while an agent run is in progress.
- The review control lives in Slidev's own navigation bar, not in a floating card.
- The review interface never covers the slides: the slide canvas stays fully visible and is resized to make room for the review sidebar.
- Navigating the deck with the keyboard (arrows, page keys, space) keeps working after every review action except while typing a note; selecting an element or the slide focuses the note field; Escape, Add and Cancel return the focus to the deck.
- A comment can target the whole slide instead of one element.
- The pending comments are listed in a sidebar where each note is readable in full.
- During a run, the author sees which comment the agent is working on and what the agent is doing, not only that it is running.
- The agent answers each comment with a short reply saying what it changed or why it did not, and the author can read it after the run.
- A run never stays stuck because the agent skipped the reporting format: a comment the agent did not report on ends with a clear state.
- Better Slide checks that the agent is installed, logged in and on the author's subscription before a send, and never starts a run it knows would fail on login or bill an API.
- The login check reads only whether the agent is logged in and how it is billed, never the account details.

## Non-goals

- Manual editing directly on the slide (text, position, size).
- A library of decks or a history of reviews.
- Themes and a theme-creation flow.
- A desktop app.
- A hosted or multi-user version.
- Supporting more than one coding agent at launch. The way agents are plugged in must leave room for another.

## Done-when

- On a demo deck, the author selects an element in the preview and writes a comment on it.
- The author stacks several comments, and can review and remove them before sending.
- One action sends the whole stack, and the resulting edits to the deck source appear in the preview with no manual reload.
- Each sent comment identifies its slide and its element, so the agent applies it without being told where to look.
- While the agent works, the author sees that it is running, and sees when it finished or failed.
- No credential and no API-key value is read, stored or shown by Better Slide at any point.
- The deck still opens in plain Slidev after a review.
- With review mode on, the slide area is narrower and no part of the review interface overlaps it, at common window sizes, in light and dark mode.
- After toggling review mode, adding, removing, sending and cancelling, the arrow keys still change the slide. Selecting puts the cursor in the note field, where the arrow keys move the cursor and not the slide; Escape, Add and Cancel give the keys back to the deck.
- The author comments on the whole slide by clicking an empty area of the slide or with a Whole slide control; the click does not change the slide, the slide is outlined, and the card says it targets the whole slide.
- The sidebar shows the comments grouped by slide, each with its whole note, and stays usable with many comments.
- During a run, each comment shows waiting, in progress, done, not done or failed, and the live activity of the agent is visible.
- After a run, each processed comment shows the agent's reply and stays visible until the author clears the finished ones. Comments not done or failed stay in the stack for the next send.
- When the agent is not logged in, not installed or would bill an API, the sidebar says so with the fix, Send is disabled, and a check again control updates it.
- When a run fails on authentication, the author is told to log in again and the comments stay in the stack for the next send.

## Open Questions

None.

## Stakeholders

- Decider: the maintainer.
- Owner: the maintainer.
- Consumer: Slidev authors who review their decks with an agent.

## Context

- Architecture and the audit behind the stack: `aidd_docs/INSTALL.md`.
- Project memory: `aidd_docs/memory/`.
