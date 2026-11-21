// Stand-in for the Claude Code CLI. It prints stream-json events in the shapes Better Slide assumes
// (decision 0002, unverified against a real run). Behaviour is chosen by the prompt read on stdin.
// Env: FAKE_CLAUDE_DELAY_MS (before anything), FAKE_CLAUDE_STEP_MS (per comment step), FAKE_CLAUDE_FAIL=1,
//      FAKE_CLAUDE_EDITS='[{"file","from","to"}]', FAKE_CLAUDE_ENV_OUT / FAKE_CLAUDE_PROMPT_OUT (files that
//      receive the env names / the prompt).
// Whole prompt:  FAIL -> error exit   HANG -> never ends   IGNORE_TERM -> HANG that survives SIGTERM
//   ERROR_RESULT -> exit 0 with a result flagged is_error   EDIT:<file>|<from>|<to> -> replaces text in a file
//   NOREPORT -> works through the comments without any report marker   ECHO -> repeats the prompt as its text
//   SPLIT -> writes each event line in two pieces
//   AUTH_FAIL -> fails like an expired login
// `auth status --json` prints FAKE_CLAUDE_AUTH_FILE's content when that file exists, else FAKE_CLAUDE_AUTH, else a
// logged-in subscription status (with a made-up account field that must never leave the adapter). HANG never answers.
// Per comment (in its note):  SKIP -> reported skipped   CRASH -> exits 1 once started   HOLD -> never ends once started
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

if (process.argv.includes('auth') && process.argv.includes('status')) {
  if (process.env.FAKE_CLAUDE_ENV_OUT) writeFileSync(process.env.FAKE_CLAUDE_ENV_OUT, JSON.stringify(Object.keys(process.env)))
  const file = process.env.FAKE_CLAUDE_AUTH_FILE
  const status =
    file && existsSync(file)
      ? readFileSync(file, 'utf8')
      : (process.env.FAKE_CLAUDE_AUTH ??
        JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', loginExpiresAt: null, email: 'fake-account@example.invalid' }))
  if (status.trim() === 'HANG') setInterval(() => {}, 1000)
  else process.stdout.write(status)
} else {
  let prompt = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (prompt += chunk))
  process.stdin.on('end', async () => {
    const split = prompt.includes('SPLIT')
    /** @param {unknown} event */
    const out = async (event) => {
      const line = `${JSON.stringify(event)}\n`
      if (!split) return void process.stdout.write(line)
      const cut = Math.floor(line.length / 2)
      process.stdout.write(line.slice(0, cut))
      await sleep(20)
      process.stdout.write(line.slice(cut))
    }
    /** @param {string} text */
    const say = (text) => out({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
    /** @param {string} name @param {Record<string, string>} input */
    const tool = (name, input) => out({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${Math.random()}`, name, input }] } })
    /** @param {number} ms */
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const step = Number(process.env.FAKE_CLAUDE_STEP_MS ?? 0)
    const slides = join(process.cwd(), 'slides.md')
    if (prompt.includes('AUTH_FAIL')) {
      await out({ type: 'result', is_error: true, result: 'Failed to authenticate: OAuth session expired and could not be refreshed' })
      return
    }

    if (process.env.FAKE_CLAUDE_ENV_OUT) {
      writeFileSync(process.env.FAKE_CLAUDE_ENV_OUT, JSON.stringify(Object.keys(process.env)))
    }
    if (process.env.FAKE_CLAUDE_PROMPT_OUT) writeFileSync(process.env.FAKE_CLAUDE_PROMPT_OUT, prompt)
    if (prompt.includes('IGNORE_TERM')) process.on('SIGTERM', () => {})
    await out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Read', 'Edit'] })
    await say('working')
    await sleep(Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 0))
    if (prompt.includes('ERROR_RESULT')) {
      await out({ type: 'result', is_error: true, result: 'agent said no' })
      return
    }
    if (prompt.includes('HANG') || prompt.includes('IGNORE_TERM')) return setInterval(() => {}, 1000)
    if (prompt.includes('FAIL') || process.env.FAKE_CLAUDE_FAIL) {
      console.error('boom: cannot continue')
      process.exit(1)
    }
    if (prompt.includes('ECHO')) await say(prompt)

    const report = !prompt.includes('NOREPORT')
    await tool('Read', { file_path: slides })
    await out({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: '...' }] } })
    for (const [, id, note] of prompt.matchAll(/^- (c\d+): .*\n {2}Change: (.*)$/gm)) {
      if (report) await say(`[[bs:${id}:start]]`)
      await sleep(step)
      if (note.includes('CRASH')) {
        console.error('boom: crashed mid-run')
        process.exit(1)
      }
      if (note.includes('HOLD')) {
        await tool('Edit', { file_path: slides, old_string: 'x', new_string: 'y' })
        return setInterval(() => {}, 1000)
      }
      if (note.includes('SKIP')) {
        if (report) await say(`[[bs:${id}:skipped]] Not done: the deck has no data for this.`)
        continue
      }
      await tool('Edit', { file_path: slides, old_string: 'x', new_string: 'y' })
      await sleep(step)
      if (report) await say(`Applied it.\n[[bs:${id}:done]] Changed as asked: ${note.slice(0, 60)}`)
    }

    for (const [, file, from, to] of prompt.matchAll(/EDIT:([^|\n]+)\|([^|\n]*)\|([^\n]*)/g)) {
      writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
    }
    for (const { file, from, to } of JSON.parse(process.env.FAKE_CLAUDE_EDITS ?? '[]')) {
      writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
    }
    await out({ type: 'result', subtype: 'success', is_error: false, result: 'I applied the review comments to slides.md.' })
  })
}
