// Stand-in for the Claude Code CLI. Behavior is chosen by the prompt read on stdin.
//   FAIL  -> error exit      HANG -> never ends      EDIT:<file>|<from>|<to> -> replaces text in a file
import { readFileSync, writeFileSync } from 'node:fs'

let prompt = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => (prompt += chunk))
process.stdin.on('end', () => {
  const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
  if (process.env.FAKE_CLAUDE_ENV_OUT) {
    writeFileSync(process.env.FAKE_CLAUDE_ENV_OUT, JSON.stringify(Object.keys(process.env)))
  }
  say('working')
  if (prompt.includes('HANG')) return setInterval(() => {}, 1000)
  if (prompt.includes('FAIL')) {
    console.error('boom: cannot continue')
    process.exit(1)
  }
  for (const [, file, from, to] of prompt.matchAll(/EDIT:([^|\n]+)\|([^|\n]*)\|([^\n]*)/g)) {
    writeFileSync(file, readFileSync(file, 'utf8').replace(from, to))
  }
  console.log(JSON.stringify({ type: 'result', is_error: false, result: 'done' }))
})
