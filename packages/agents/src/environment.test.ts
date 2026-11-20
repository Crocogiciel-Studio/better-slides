import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAgentEnv, resolveCommand } from './environment.ts'

describe('buildAgentEnv', () => {
  it('drops both API-key variables and keeps the rest', () => {
    const env = buildAgentEnv({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', HOME: '/h' })
    expect(env).toEqual({ HOME: '/h' })
  })

  it('does not mutate the parent', () => {
    const parent = { ANTHROPIC_API_KEY: 'a' }
    buildAgentEnv(parent)
    expect(parent.ANTHROPIC_API_KEY).toBe('a')
  })
})

describe('resolveCommand', () => {
  function fakeShell(body: string): string {
    const path = join(mkdtempSync(join(tmpdir(), 'shell-')), 'sh')
    writeFileSync(path, `#!/bin/sh\n${body}\n`)
    chmodSync(path, 0o755)
    return path
  }

  it('finds the CLI through the login shell even with a minimal environment', async () => {
    const shell = fakeShell('echo "welcome banner"; echo /opt/tools/claude')
    expect(await resolveCommand('claude', { shell, env: { PATH: '' } })).toBe('/opt/tools/claude')
  })

  it('resolves undefined when the CLI is missing', async () => {
    const shell = fakeShell('exit 1')
    expect(await resolveCommand('claude', { shell, env: {} })).toBeUndefined()
  })
})
