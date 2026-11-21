# 0002 - Agent headless launch (Claude Code)

Status: accepted (2026-11-20). Based on `claude --version` (2.1.329) and `claude --help` only.

## What the CLI documents

- `-p, --print`: non-interactive; prints the response and exits. The workspace trust dialog is skipped in this mode.
- `--output-format <text|json|stream-json>`: `stream-json` streams events in real time; it needs `--verbose` alongside `--print`.
- `--permission-mode <acceptEdits|auto|bypassPermissions|manual|dontAsk|plan>`.
- `--allowedTools` / `--disallowedTools`: tool allow and deny lists.
- `--input-format <text|stream-json>`: `text` is the default.

## Chosen launch

`claude -p --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep`, run in the deck folder, prompt written to stdin (keeps a long prompt out of the argument list, which `--allowedTools` would otherwise swallow).

- Edits are accepted without a prompt; shell commands are not on the allow list.
- The child environment is the parent's minus every `ANTHROPIC_*`, `OPENAI_*` and `CLAUDE_CODE_USE_*` variable, so the CLI uses the user's own login. Credentials are never read.
- The CLI is located through a login shell (`$SHELL -l -c 'command -v claude'`).
- Event mapping (adapter only; nothing else knows these shapes), updated 2026-11-21 for per-comment feedback:
  - one JSON object per line; a line split across output chunks is reassembled; a non-JSON line is ignored;
  - `assistant` with `message.content[]`: each `text` item -> `{ type: 'text' }`; each `tool_use` item -> `{ type: 'activity' }` with `Read` -> read, `Edit`/`MultiEdit`/`Write`/`NotebookEdit` -> edit, `Grep`/`Glob`/`LS` -> search, any other tool or a missing input -> other. The target is `input.file_path` (or `notebook_path`, `path`) made relative to the deck, or its base name when outside it; for a search, `input.pattern`. No absolute path reaches the UI;
  - `result` -> its `result` text is kept as the final text of `finished`; with `is_error: true` -> failed with that text;
  - `system`, `user` (tool results) and any unknown type or field -> ignored;
  - a non-zero exit -> failed with the end of stderr; `cancel()` -> failed of kind `cancelled`.
- Per-comment report: the prompt gives each comment an id (`c<n>`) and asks for `[[bs:<id>:start]]`, then `[[bs:<id>:done]] <reply>` or `[[bs:<id>:skipped]] <reason>`. `packages/review/src/report.ts` reads them from `text` events only.

## Login readiness (added 2026-11-21)

- `claude auth status --json` (seen on 2.1.329, read-only, no prompt sent) exits 0 and prints JSON with `loggedIn`, `authMethod` (`claude.ai` on a subscription), `apiProvider` (`firstParty`), `loginExpiresAt`, and account fields. The adapter reads only `loggedIn`, `authMethod` and `apiProvider`; account fields are never read, logged, returned or shown.
- Mapping: CLI not found -> not installed; `loggedIn: false` -> not logged in (hint: run `claude` then `/login`); `apiProvider` other than `firstParty`, or an `authMethod` naming an API key or the console -> API billing, not ready; `authMethod` matching `claude.ai` -> ready. Anything else, malformed output or the 5 s timeout -> unknown, which still allows a send.
- It runs with the same stripped environment and command lookup as a run. The server caches the answer 30 s, refreshes it on demand and right before every send.
- At run time, a failure whose text mentions authentication, OAuth, login or 401 is reported as an auth failure with the login hint; its comments go back to waiting.

## Unverified

- No prompt was sent to the real CLI (it would spend the user's subscription). A real run under the user's login is unverified.
- That a prompt on stdin with `-p` and no positional prompt is accepted by 2.1.329, and the exact stream-json event shapes, are assumed from the CLI's documented formats and tested only against a fake script.
- That `acceptEdits` plus the allow list is enough for edits without a permission prompt.
- The event mapping above is still unverified against a real run: the `assistant`/`tool_use`/`result` shapes and the tool names come from the commonly documented format and are exercised only with `fake-claude.mjs`. If the real stream differs, activity shows less (an unknown shape is ignored, never a crash) and comments end `unconfirmed` with the final text.
- Whether the real agent prints the report markers reliably is unknown; the run-end fallback exists for that case.
- `auth status` can report `loggedIn: true` for a session that turns out expired at run time (the author's real run failed with "Failed to authenticate: OAuth session expired and could not be refreshed"); that is why the run-time auth path exists. `loginExpiresAt` is not used: whether it is the session's limit is unknown. The `authMethod` values for an API key or the console are guessed (`api`, `key`, `console`); only `claude.ai` was observed.
- Where the real CLI prints an expired-login error (result event, stderr, or assistant text) is unverified; the result text and stderr are matched.
