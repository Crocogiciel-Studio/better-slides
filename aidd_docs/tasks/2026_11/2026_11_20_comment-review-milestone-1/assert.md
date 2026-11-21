# Assert: Better Slide milestone 1, comment-based review

## Round 1

- Head: `85cb4ee`
- Uncommitted changes: unknown, not recorded at the time (CLAUDE.md was in fact modified). Superseded by round 2.
- Verdict: PASS

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm typecheck` | 0 | |
| `pnpm test` | 0 | |
| `grep -rniE "claude\|codex" packages ...` outside `packages/agents` and tests (assertion: only agents name a CLI) | 1 | no match (grep exits 1 when nothing matches, which is the pass; round 1 wrote 0) |
| `grep` for `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` outside `packages/agents` and tests (assertion: no API-key variable handled elsewhere) | 1 | no match (pass; round 1 wrote 0) |

## Round 2

- Head: `07769c0` (code and checks); this file and `run.md` are committed after it, docs only.
- Uncommitted changes: none at the check, apart from this file.
- Verdict: PASS for what ran. A real Claude Code run is still not verified.

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm typecheck` (`vue-tsc --noEmit`: packages, `.vue` files, `fake-claude.mjs`) | 0 | |
| `pnpm test` (11 files, 76 tests) | 0 | |
| `grep -rniE "claude\|codex" packages --include=*.ts --include=*.vue --include=*.mjs -l --exclude-dir=agents --exclude="*.test.ts"` (only agents name a CLI) | 1 | no match: pass |
| `grep -rnE "ANTHROPIC_API_KEY\|OPENAI_API_KEY" packages -l --include=*.ts --include=*.vue --exclude-dir=agents --exclude="*.test.ts"` | 1 | no match: pass |

## Round 3

- Head: `5a04c90` (code and checks); `1c9db3f` adds docs only. Uncommitted changes at the check: none apart from this file and `run.md`.
- Verdict: PASS for what ran. A real Claude Code run is still not verified.

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm typecheck` | 0 | |
| `pnpm test` (13 files, 94 tests, including the Chromium test) | 0 | |
| `grep -rniE "claude\|codex" packages --include=*.ts --include=*.vue --include=*.mjs -l --exclude-dir=agents --exclude="*.test.ts"` | 1 | no match: pass |
| `grep -rnE "ANTHROPIC_API_KEY\|OPENAI_API_KEY" packages -l --include=*.ts --include=*.vue --exclude-dir=agents --exclude="*.test.ts"` | 1 | no match: pass |
| Spec lines on the review interface (bar, never covers, keyboard, grouped readable notes) | n/a | covered by the Chromium test and by viewing the screenshots, see Run 3 |

## Round 4

- Head: `56a4183`
- Uncommitted changes: yes (docs only: README, memory, spec, plan, phase files; committed after as `af4a341`)
- Verdict: PASS

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm typecheck` | 0 | |
| `pnpm test` (14 files, 168 tests, including the Chromium test) | 0 | |
| `npx vitest run packages/addon/e2e`, three runs in a row (18 tests each) | 0, 0, 0 | |
| `grep -rniE "claude\|codex" packages --include=*.ts --include=*.vue --include=*.mjs -l --exclude-dir=agents --exclude="*.test.ts" --exclude-dir=node_modules` | 1 | no match: pass |
| `grep -rnE "ANTHROPIC_API_KEY\|OPENAI_API_KEY" packages -l --include=*.ts --include=*.vue --exclude-dir=agents --exclude="*.test.ts" --exclude-dir=node_modules` | 1 | no match: pass |
| `grep -rnE "\b(email\|orgId\|orgName\|subscriptionType\|planTier)\b" packages --include=*.ts --include=*.vue -l --exclude-dir=node_modules --exclude="*.test.ts"` (no account field read) | 1 | no match: pass |
| `grep -rn "fetch(" packages ... --exclude-dir=e2e --exclude="*.test.ts"` outside `addon/components/api.ts` (no own network connection) | 1 | no match: pass |

Not verified: a real Claude Code run and its stream-json shapes; whether the real agent prints the report markers; the `authMethod` value of an API-key or console login; where the real CLI prints an expired-login error; Slidev other than 53.1.0; hash router mode; touch devices; screen readers.
