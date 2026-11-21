import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildAgentEnv, resolveCommand } from './environment.ts'

describe('buildAgentEnv', () => {
  it('drops both API-key variables and keeps the rest', () => {
    const env = buildAgentEnv({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o', HOME: '/h' })
    expect(env).toEqual({ HOME: '/h' })
  })

  it('drops every provider-routing variable and keeps unrelated ones', () => {
    const provider = [
      'ANTHROPIC_AUTH_TOKEN',
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_MODEL',
      'CLAUDE_CODE_USE_BEDROCK',
      'CLAUDE_CODE_USE_VERTEX',
      'CLAUDE_CODE_USE_FOUNDRY',
      'OPENAI_BASE_URL',
      'OPENAI_ORG_ID',
    ]
    const keep = { PATH: '/bin', HOME: '/h', CLAUDE_CONFIG_DIR: '/c', ANTHROPIC: 'x', MY_OPENAI_KEY: 'k' }
    const env = buildAgentEnv({ ...keep, ...Object.fromEntries(provider.map((n) => [n, 'v'])) })
    expect(env).toEqual(keep)
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
    const shell = fakeShell('for a; do last=$a; done; echo "welcome banner"; command() { echo /opt/tools/claude; }; eval "$last"')
    expect(await resolveCommand('claude', { shell, env: { PATH: '' } })).toBe('/opt/tools/claude')
  })

  /** A shell that only sees the CLI when interactive (`needs` is the case pattern over its flags), like a PATH set in an rc file. */
  function rcOnlyShell(afterNoise = 'true', name = 'zsh', needs = '*" -i "*'): string {
    const dir = mkdtempSync(join(tmpdir(), 'rc-'))
    const bin = join(dir, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, 'claude'), '#!/bin/sh\n')
    chmodSync(join(bin, 'claude'), 0o755)
    const path = join(dir, name)
    writeFileSync(
      path,
      `#!/bin/sh
for a; do last=$a; done
case " $* " in ${needs}) echo "rc noise /fake/path"; PATH="${bin}:$PATH"; ${afterNoise};; esac
exec /bin/sh -c "$last"
`,
    )
    chmodSync(path, 0o755)
    return path
  }

  it('falls back to an interactive shell for a PATH set only in the rc file, ignoring rc noise', async () => {
    const shell = rcOnlyShell()
    const found = await resolveCommand('claude', { shell, env: { PATH: '/usr/bin:/bin' } })
    expect(found).toMatch(/\/rc-[^/]+\/bin\/claude$/)
  })

  it('falls back to a non-login interactive bash for a PATH set only in ~/.bashrc', async () => {
    const shell = rcOnlyShell('true', 'bash', '*" -i -c "*')
    const found = await resolveCommand('claude', { shell, env: { PATH: '/usr/bin:/bin' } })
    expect(found).toMatch(/\/rc-[^/]+\/bin\/claude$/)
  })

  it('refuses a name that is not a plain command', async () => {
    for (const name of ['claude; rm -rf ~', '$(id)', 'a b', '', '`x`']) {
      await expect(resolveCommand(name, { shell: '/bin/false' })).rejects.toThrow('Invalid command name')
    }
  })

  it('gives up after the timeout when the rc file hangs', async () => {
    const shell = rcOnlyShell('sleep 5')
    const started = Date.now()
    expect(await resolveCommand('claude', { shell, env: { PATH: '/usr/bin:/bin' }, timeoutMs: 300 })).toBeUndefined()
    expect(Date.now() - started).toBeLessThan(3000)
  })

  it('resolves undefined when the CLI is missing', async () => {
    const shell = fakeShell('exit 1')
    expect(await resolveCommand('claude', { shell, env: {} })).toBeUndefined()
  })
})
