# Better Slide

Review your [Slidev](https://sli.dev) deck slide by slide, leave comments on the exact elements you want changed, and send them all at once to a coding agent that runs on your own subscription.

> **Status: milestone 1 built, not yet released.** Comment-based review works end to end against a fake agent. A real run with your own Claude Code login has not been verified yet (see [Known limits](#known-limits)). Architecture and decisions: [`aidd_docs/INSTALL.md`](aidd_docs/INSTALL.md).

## Try the demo

```bash
pnpm install
pnpm demo        # Slidev on http://localhost:3030 with the addon enabled
```

In the preview, move the mouse to the bottom-left to reveal Slidev's navigation bar and press the **Review** button (speech bubble, or press `r`). A sidebar opens on the right and the slide shrinks to make room; it is never covered. Click an element on the slide: the note field in the sidebar takes the cursor at once, so just type, then press `Enter` or **Add**. To comment on the slide as a whole, click an empty area of the slide, or press **Whole slide** in the sidebar (handy when a slide has no empty area); the slide is outlined and the card reads *Slide N · whole slide*. If you click another element while typing, your note is kept and its target changes. The sidebar lists your comments by slide with each note in full; stack as many as you like, then **Send stack**. Press the button or `r` again, or the close icon, to leave review mode. The arrow keys, space and page keys keep navigating the deck after every button press. While the cursor is in the note field they move the cursor instead; `Escape`, **Add** and **Cancel** give them back to the deck. Claude Code (`claude`, installed and logged in) edits `slides.md` and the preview hot-reloads.

During a run, each comment card shows its state: **Waiting**, **In progress**, **Done**, **Not done** or **Failed**. The footer says what the agent is doing (for example *Editing slides.md*) and which comment it is on (*Comment 2 of 3*), with **Cancel**. After the run, each comment keeps the agent's one-line reply: what it changed, or why it did not. Done comments stay until you press **Clear finished**. Not done and failed comments stay in the stack and are sent again with the next **Send stack**; remove them if you do not want that. If the agent never reported on a comment, the card says **Unconfirmed** and shows the agent's final text instead: check the slide yourself. A cancel or a failure leaves nothing in progress: reported comments keep their outcome, the others go back to waiting.

Next to **Send stack**, the sidebar says whether the agent can run: *Claude Code: ready*, *Not logged in: run `claude` then `/login`*, *Claude Code not found*, or *Uses API billing, not your subscription*. Send is disabled until it is ready; fix it in a terminal, then press **Check again**. Better Slide asks `claude auth status` only whether you are logged in and how you are billed, never your account details. If a run still fails on login, the sidebar says so and your comments stay waiting for the next send.

The addon is not published yet: `slidev-addon-better-slide` is private (version 0.0.0), so `npm install` cannot fetch it. It works only inside this workspace. To review your own deck:

1. Put the deck in a new folder under `examples/` (the workspace includes `examples/*`), for example `examples/my-deck/` with a `slides.md` and a `package.json` modelled on `examples/demo-deck/package.json`.
2. In that `package.json`, depend on the addon with `"slidev-addon-better-slide": "workspace:*"`, next to `@slidev/cli` 53.1.0.
3. In `slides.md` front matter, add `addons: [better-slide]`.
4. Run `pnpm install` at the repository root, then `pnpm --filter my-deck exec slidev --port 3030`.

The review API answers only on loopback (`localhost`, `127.0.0.1`, `[::1]`). Serving the deck on the network with `--host` is not supported yet: the API refuses those requests.

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
- **Your subscription, not the API.** Better Slide launches the CLI you already installed and logged in (Claude Code today, Codex planned). It never reads, copies or stores your credentials.

## Known limits

- The rendered element is tied to the source by slide, text excerpt and selector. A line number is added when the excerpt is found in the slide, as a best-effort hint only: it can be missing or point at the first of several matches ([decision 0001](aidd_docs/memory/internal/decisions/0001-element-source-link.md)).
- The deck can only be reviewed on loopback, not with `--host`.
- Terms of use: whether a provider allows its subscription to be used through a third-party tool is not settled, and the sources found disagree. Better Slide only launches the CLI you installed, as you, and never touches your login. Check Anthropic's and OpenAI's current terms before relying on it.
- `claude auth status` can say you are logged in while the session has in fact expired; the first send then fails on login and tells you to log in again. A readiness check that cannot be read (new CLI output, timeout) shows a warning but does not block sending.
- Only Claude Code is supported. The agent layer leaves room for another CLI.
- The Claude Code launch flags and the shape of its event stream come from the CLI's documented help and are untested against a real run ([decision 0002](aidd_docs/memory/internal/decisions/0002-agent-headless-launch.md)). The per-comment states depend on the agent printing short report markers; when it does not, comments end **Unconfirmed**.

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
