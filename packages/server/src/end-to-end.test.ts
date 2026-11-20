import { createClaudeCodeAgent } from '@better-slide/agents'
import { locateLine } from '@better-slide/review'
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApp } from './index.ts'

const root = new URL('../../..', import.meta.url).pathname
const fake = join(root, 'packages/agents/test/fixtures/fake-claude.mjs')
const SECRET = 'sk-test-secret-value'

describe('comment, stack, send against a fake agent', () => {
  it('applies the stack to the deck, with no API key reaching the agent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deck-'))
    const slides = join(dir, 'slides.md')
    cpSync(join(root, 'examples/demo-deck/slides.md'), slides)
    const original = readFileSync(slides, 'utf8')
    const out = (name: string) => join(dir, name)

    const agent = createClaudeCodeAgent({
      launcher: { command: process.execPath, args: [fake] },
      env: {
        PATH: process.env.PATH,
        ANTHROPIC_API_KEY: SECRET,
        OPENAI_API_KEY: SECRET,
        FAKE_CLAUDE_ENV_OUT: out('env.json'),
        FAKE_CLAUDE_PROMPT_OUT: out('prompt.txt'),
        FAKE_CLAUDE_EDITS: JSON.stringify([
          { file: slides, from: 'Write a short note', to: 'Write a precise note' },
          { file: slides, from: '# Wrap up', to: '# Summary' },
        ]),
      },
    })
    // parts[0] is the headmatter, so slide n is parts[n].
    const parts = original.split(/\n---\n/)
    const app = createApp({
      agent,
      cwd: dir,
      locate: (slide, text) => locateLine(original, parts[slide] ?? '', text),
    })
    const call = (method: string, path: string, body?: unknown) =>
      app.request(`/__better-slide${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { 'content-type': 'application/json' },
      })

    const bodies: string[] = []
    for (const c of [
      { slide: 2, text: 'Write a short note', selector: 'ul > li:nth-of-type(2)', note: 'Be precise' },
      { slide: 4, text: 'Wrap up', selector: 'h1', note: 'Rename to Summary' },
    ]) {
      const res = await call('POST', '/comments', c)
      const text = await res.text()
      expect(JSON.parse(text).line).toBeGreaterThan(0)
      bodies.push(text)
    }
    expect((await call('POST', '/send')).status).toBe(202)

    for (let i = 0; i < 100; i++) {
      const status = await (await call('GET', '/status')).json()
      bodies.push(JSON.stringify(status))
      if (status.state === 'finished') break
      expect(status.state).not.toBe('failed')
      await new Promise((r) => setTimeout(r, 50))
    }

    const edited = readFileSync(slides, 'utf8')
    expect(edited).toContain('Write a precise note')
    expect(edited).toContain('# Summary')
    expect(readFileSync(out('prompt.txt'), 'utf8')).toContain('Rename to Summary')

    const envNames: string[] = JSON.parse(readFileSync(out('env.json'), 'utf8'))
    expect(envNames).not.toContain('ANTHROPIC_API_KEY')
    expect(envNames).not.toContain('OPENAI_API_KEY')

    bodies.push(await (await call('GET', '/comments')).text())
    expect(bodies.join('\n')).not.toContain(SECRET)
  })
})
