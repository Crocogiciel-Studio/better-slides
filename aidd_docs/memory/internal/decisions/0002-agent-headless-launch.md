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
- The child environment is the parent's minus `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`, so the CLI uses the user's own login. Credentials are never read.
- The CLI is located through a login shell (`$SHELL -l -c 'command -v claude'`).
- Event mapping: `assistant` text -> progress; `result` with `is_error` or a non-zero exit -> failed.

## Unverified

- No prompt was sent to the real CLI (it would spend the user's subscription). A real run under the user's login is unverified.
- That a prompt on stdin with `-p` and no positional prompt is accepted by 2.1.329, and the exact stream-json event shapes, are assumed from the CLI's documented formats and tested only against a fake script.
- That `acceptEdits` plus the allow list is enough for edits without a permission prompt.
