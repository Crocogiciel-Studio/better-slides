# Better Slide

Review your [Slidev](https://sli.dev) deck slide by slide, leave comments on the exact elements you want changed, and send them all at once to a coding agent that runs on your own subscription.

> **Status: design phase.** There is no code yet. This README describes what Better Slide is meant to do. The architecture and decisions live in [`aidd_docs/INSTALL.md`](aidd_docs/INSTALL.md).

## The idea

1. Open your Slidev deck with Better Slide.
2. Browse the slides, select an element, write a comment.
3. Keep stacking comments as you go through the deck.
4. Send the whole stack to your coding agent. Each comment is structured (which slide, which element, what to change) so the agent can fix things without spending tokens searching your deck.
5. The agent edits `slides.md`, and the preview updates live through Slidev's hot reload.

Later milestones add a library to find your decks and past reviews again, and themes with a guided creation flow (colors, fonts, style).

## How it works

- **Built on Slidev.** A deck stays a regular Slidev project. You can open it without Better Slide.
- **Local only.** Everything runs on your machine. There is no account and no hosted service.
- **Your subscription, not the API.** Better Slide launches the CLI you already installed and logged in (Claude Code, Codex). It never reads, copies or stores your credentials.

## Roadmap

| Milestone | Content |
| --------- | ------- |
| 1 | Comment-based review with the agent |
| 2 | Deck library and review history |
| 3 | Themes and a guided theme-creation flow |

Out of scope for now: manual editing directly on the slide, and a desktop app.

## Contributing

Contributions are welcome, see [`CONTRIBUTING.md`](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, read [`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE)
