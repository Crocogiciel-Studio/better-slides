import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../agent.ts'
import { createClaudeCodeAgent, parseStreamLine } from './claude-code.ts'

const fake = new URL('../../test/fixtures/fake-claude.mjs', import.meta.url).pathname
const launcher = { command: process.execPath, args: [fake] }

async function run(prompt: string, options = {}, cwd = tmpdir()) {
  const events: AgentEvent[] = []
  const agent = createClaudeCodeAgent({ launcher, ...options })
  const handle = agent.run({ prompt, cwd }, (e) => events.push(e))
  await handle.done
  return events
}

describe('claude-code adapter', () => {
  it('emits running, the agent text, its file activity and finished with the final text', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'deck-'))
    const events = await run('Slide 2\n- c1: text "Intro", selector `h1`\n  Change: Shorter\n- c2: text "X", selector `p`\n  Change: SKIP it', {}, cwd)
    expect(events).toEqual([
      { type: 'running' },
      { type: 'text', text: 'working' },
      { type: 'activity', action: 'read', target: 'slides.md' },
      { type: 'text', text: '[[bs:c1:start]]' },
      { type: 'activity', action: 'edit', target: 'slides.md' },
      { type: 'text', text: 'Applied it.\n[[bs:c1:done]] Changed as asked: Shorter' },
      { type: 'text', text: '[[bs:c2:start]]' },
      { type: 'text', text: '[[bs:c2:skipped]] Not done: the deck has no data for this.' },
      { type: 'finished', result: 'I applied the review comments to slides.md.' },
    ])
  })

  it('reassembles event lines split across output chunks', async () => {
    const events = await run('SPLIT\n- c1: text "a", selector `p`\n  Change: b')
    expect(events.filter((e) => e.type === 'text').map((e) => e.type === 'text' && e.text)).toContain('[[bs:c1:start]]')
    expect(events.at(-1)?.type).toBe('finished')
  })

  it('fails mid-run and reports what happened before', async () => {
    const events = await run('- c1: text "a", selector `p`\n  Change: ok\n- c2: text "b", selector `p`\n  Change: CRASH')
    expect(events.some((e) => e.type === 'text' && e.text.includes('[[bs:c1:done]]'))).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'failed', reason: expect.stringContaining('crashed mid-run') })
  })

  it('emits failed with the reason when the CLI errors', async () => {
    const events = await run('FAIL')
    expect(events.at(-1)).toEqual({ type: 'failed', reason: expect.stringContaining('boom') })
  })

  it('emits failed, without crashing, when the CLI is missing', async () => {
    const events = await run('x', { launcher: { command: '/nonexistent/claude' } })
    expect(events.at(-1)).toEqual({ type: 'failed', reason: expect.stringContaining('not found') })
  })

  it('emits failed when the login shell cannot find the CLI', async () => {
    const events = await run('x', { launcher: undefined, shell: '/bin/false' })
    expect(events).toEqual([{ type: 'failed', reason: expect.stringContaining('not found') }])
  })

  it('never passes an API-key variable to the CLI', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'env-')), 'env.json')
    await run('x', {
      env: { PATH: process.env.PATH, ANTHROPIC_API_KEY: 'secret', OPENAI_API_KEY: 'secret', FAKE_CLAUDE_ENV_OUT: out },
    })
    const names: string[] = JSON.parse(readFileSync(out, 'utf8'))
    expect(names).toContain('FAKE_CLAUDE_ENV_OUT')
    expect(names).not.toContain('ANTHROPIC_API_KEY')
    expect(names).not.toContain('OPENAI_API_KEY')
  })

  const until = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 25))
    expect(check()).toBe(true)
  }

  it('stops the child process on cancel', async () => {
    const events: AgentEvent[] = []
    const handle = createClaudeCodeAgent({ launcher }).run({ prompt: 'HANG', cwd: tmpdir() }, (e) => events.push(e))
    await until(() => events.some((e) => e.type === 'running'))
    handle.cancel()
    await handle.done
    expect(events.at(-1)).toEqual({ type: 'failed', reason: 'cancelled', kind: 'cancelled' })
  })

  it('escalates to SIGKILL when the CLI ignores SIGTERM', async () => {
    const events: AgentEvent[] = []
    const handle = createClaudeCodeAgent({ launcher, killGraceMs: 200 }).run({ prompt: 'IGNORE_TERM', cwd: tmpdir() }, (e) =>
      events.push(e),
    )
    await until(() => events.some((e) => e.type === 'text'))
    handle.cancel()
    await handle.done
    expect(events.at(-1)).toEqual({ type: 'failed', reason: 'cancelled', kind: 'cancelled' })
  })

  it('fails the run and stops the CLI when it exceeds the timeout', async () => {
    const events = await run('HANG', { timeoutMs: 300, killGraceMs: 200 })
    expect(events.at(-1)).toEqual({ type: 'failed', reason: expect.stringContaining('timed out') })
  })

  it('fails with the reported error when the CLI exits 0 but flags is_error', async () => {
    const events = await run('ERROR_RESULT')
    expect(events.at(-1)).toEqual({ type: 'failed', reason: 'agent said no' })
  })

  it('does not spawn when cancelled while the CLI is being looked up', async () => {
    const shell = join(mkdtempSync(join(tmpdir(), 'shell-')), 'sh')
    writeFileSync(shell, '#!/bin/sh\nfor a; do last=$a; done; sleep 0.3; command() { echo /nonexistent/claude; }; eval "$last"\n')
    chmodSync(shell, 0o755)
    const events: AgentEvent[] = []
    const handle = createClaudeCodeAgent({ shell }).run({ prompt: 'x', cwd: tmpdir() }, (e) => events.push(e))
    handle.cancel()
    await handle.done
    expect(events).toEqual([{ type: 'failed', reason: 'cancelled', kind: 'cancelled' }])
  })
})

describe('stream-json mapping', () => {
  const cwd = '/home/me/deck'
  const line = (content: unknown) => JSON.stringify({ type: 'assistant', message: { content } })
  const tool = (name: string, input?: unknown) => parseStreamLine(line([{ type: 'tool_use', name, input }]), cwd).events

  it('maps file tools to generic actions with a path relative to the deck', () => {
    expect(tool('Read', { file_path: '/home/me/deck/slides.md' })).toEqual([{ type: 'activity', action: 'read', target: 'slides.md' }])
    expect(tool('Edit', { file_path: '/home/me/deck/pages/intro.md' })).toEqual([{ type: 'activity', action: 'edit', target: 'pages/intro.md' }])
    expect(tool('Write', { file_path: 'slides.md' })).toEqual([{ type: 'activity', action: 'edit', target: 'slides.md' }])
    expect(tool('Grep', { pattern: 'Install' })).toEqual([{ type: 'activity', action: 'search', target: 'Install' }])
    expect(tool('Glob', { pattern: '/home/me/deck/**/*.md' })).toEqual([{ type: 'activity', action: 'search', target: '*.md' }])
  })

  it('never shows an absolute path outside the deck', () => {
    expect(tool('Read', { file_path: '/etc/hosts' })).toEqual([{ type: 'activity', action: 'read', target: 'hosts' }])
    expect(tool('Read', { file_path: '/home/me/other/secret.md' })).toEqual([{ type: 'activity', action: 'read', target: 'secret.md' }])
  })

  it('gives other for an unknown tool or a missing input', () => {
    expect(tool('Bash', { command: 'ls' })).toEqual([{ type: 'activity', action: 'other' }])
    expect(tool('Read')).toEqual([{ type: 'activity', action: 'other' }])
    expect(tool('Read', 'not an object')).toEqual([{ type: 'activity', action: 'other' }])
    expect(tool('Read', {})).toEqual([{ type: 'activity', action: 'read' }])
  })

  it('keeps text and tool calls of one message in order', () => {
    const events = parseStreamLine(line([{ type: 'text', text: 'a' }, { type: 'tool_use', name: 'Read', input: { file_path: 'slides.md' } }, { type: 'thinking', thinking: 'x' }]), cwd).events
    expect(events.map((e) => e.type)).toEqual(['text', 'activity'])
  })

  it('reads the final text and the error flag of a result', () => {
    expect(parseStreamLine(JSON.stringify({ type: 'result', is_error: false, result: 'done' }), cwd)).toEqual({ events: [], result: 'done' })
    expect(parseStreamLine(JSON.stringify({ type: 'result', is_error: true, result: 'no' }), cwd)).toEqual({ events: [], error: 'no' })
  })

  it('ignores unknown types, odd fields and lines that are not JSON, without throwing', () => {
    for (const l of ['', 'not json', 'null', '42', '[]', '{"type":"system","subtype":"init"}', '{"type":"user","message":{"content":[{"type":"tool_result"}]}}',
      '{"type":"assistant"}', '{"type":"assistant","message":{"content":"text"}}', '{"type":"assistant","message":{"content":[null,1,{"type":"text","text":5}]}}', '{"type":"stream_event","event":{}}']) {
      expect(parseStreamLine(l, cwd).events, l).toEqual([])
    }
  })
})
