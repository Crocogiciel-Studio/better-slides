// Stand-in for the Claude Code CLI. Behavior is chosen by the prompt read on stdin.
// Env: FAKE_CLAUDE_DELAY_MS, FAKE_CLAUDE_FAIL=1, FAKE_CLAUDE_EDITS='[{"file","from","to"}]',
//      FAKE_CLAUDE_ENV_OUT / FAKE_CLAUDE_PROMPT_OUT (files that receive the env names / the prompt).
//   FAIL  -> error exit      HANG -> never ends      IGNORE_TERM -> HANG that survives SIGTERM
//   ERROR_RESULT -> exit 0 with a result event flagged is_error      EDIT:<file>|<from>|<to> -> replaces text in a file
import { readFileSync, writeFileSync } from 'node:fs'

let prompt = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => (prompt += chunk))
process.stdin.on('end', async () => {
  const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
  if (process.env.FAKE_CLAUDE_ENV_OUT) {
    writeFileSync(process.env.FAKE_CLAUDE_ENV_OUT, JSON.stringify(Object.keys(process.env)))
  }
  if (process.env.FAKE_CLAUDE_PROMPT_OUT) writeFileSync(process.env.FAKE_CLAUDE_PROMPT_OUT, prompt)
  if (prompt.includes('IGNORE_TERM')) process.on('SIGTERM', () => {})
  say('working')
  await new Promise((r) => setTimeout(r, Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 0)))
  if (prompt.includes('ERROR_RESULT')) {
    console.log(JSON.stringify({ type: 'result', is_error: true, result: 'agent said no' }))
    return
  }
  if (prompt.includes('HANG') || prompt.includes('IGNORE_TERM')) return setInterval(() => {}, 1000)
  if (prompt.includes('FAIL') || process.env.FAKE_CLAUDE_FAIL) {
    console.error('boom: cannot continue')
    process.exit(1)
  }
  for (const [, file, from, to] of prompt.matchAll(/EDIT:([^|\n]+)\|([^|\n]*)\|([^\n]*)/g)) {
    writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
  }
  for (const { file, from, to } of JSON.parse(process.env.FAKE_CLAUDE_EDITS ?? '[]')) {
    writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
  }
  console.log(JSON.stringify({ type: 'result', is_error: false, result: 'done' }))
})
