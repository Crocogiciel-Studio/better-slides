import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../agent.ts'
import { createClaudeCodeAgent } from './claude-code.ts'

const fake = new URL('../../test/fixtures/fake-claude.mjs', import.meta.url).pathname
const launcher = { command: process.execPath, args: [fake] }

async function run(prompt: string, options = {}) {
  const events: AgentEvent[] = []
  const agent = createClaudeCodeAgent({ launcher, ...options })
  const handle = agent.run({ prompt, cwd: tmpdir() }, (e) => events.push(e))
  await handle.done
  return events
}

describe('claude-code adapter', () => {
  it('emits running then finished', async () => {
    const events = await run('do it')
    expect(events.map((e) => e.type)).toEqual(['running', 'progress', 'finished'])
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
    expect(events.at(-1)).toEqual({ type: 'failed', reason: 'cancelled' })
  })

  it('escalates to SIGKILL when the CLI ignores SIGTERM', async () => {
    const events: AgentEvent[] = []
    const handle = createClaudeCodeAgent({ launcher, killGraceMs: 200 }).run({ prompt: 'IGNORE_TERM', cwd: tmpdir() }, (e) =>
      events.push(e),
    )
    await until(() => events.some((e) => e.type === 'progress'))
    handle.cancel()
    await handle.done
    expect(events.at(-1)).toEqual({ type: 'failed', reason: 'cancelled' })
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
    expect(events).toEqual([{ type: 'failed', reason: 'cancelled' }])
  })
})
