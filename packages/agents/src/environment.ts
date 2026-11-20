import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'

const PROVIDER_PREFIXES = ['ANTHROPIC_', 'OPENAI_', 'CLAUDE_CODE_USE_']

/** True for variables that would make an agent CLI bill an API or another provider instead of the user's subscription. */
export function isProviderVariable(name: string): boolean {
  return PROVIDER_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/** Copy of `parent` without any provider variable (`ANTHROPIC_*`, `OPENAI_*`, `CLAUDE_CODE_USE_*`). */
export function buildAgentEnv(parent: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(parent).filter(([name]) => !isProviderVariable(name)))
}

export interface ResolveOptions {
  /** Login shell to ask. Defaults to `$SHELL`, then `/bin/sh`. */
  shell?: string
  env?: NodeJS.ProcessEnv
  /** Per shell attempt, so a slow rc file cannot hang the caller. Defaults to 10 s. */
  timeoutMs?: number
}

/** Runs `command -v name` in the shell and returns the path found between unique markers, if any. */
function ask(shell: string, flags: string[], name: string, env: NodeJS.ProcessEnv, timeout: number): Promise<string | undefined> {
  const id = randomBytes(8).toString('hex')
  const script = `printf '%s' "BS_${id}_START$(command -v ${name})BS_${id}_END"`
  return new Promise((resolve) => {
    execFile(shell, [...flags, script], { env: buildAgentEnv(env), timeout, killSignal: 'SIGKILL' }, (error, stdout) => {
      const path = stdout?.match(new RegExp(`BS_${id}_START(.*)BS_${id}_END`, 's'))?.[1]
      resolve(error || !path?.startsWith('/') ? undefined : path)
    })
  })
}

/**
 * Finds an executable through a login shell: a process launched outside the user's
 * interactive shell lacks its `PATH`. zsh and bash read `~/.zshrc` and `~/.bashrc` only when
 * interactive, so they get a second, interactive attempt. The path is read between unique
 * markers, so rc-file output is ignored. Resolves `undefined` when it is not found.
 */
export async function resolveCommand(name: string, options: ResolveOptions = {}): Promise<string | undefined> {
  const env = options.env ?? process.env
  const shell = options.shell ?? env.SHELL ?? '/bin/sh'
  const timeout = options.timeoutMs ?? 10_000
  const found = await ask(shell, ['-l', '-c'], name, env, timeout)
  if (found || !['zsh', 'bash'].includes(basename(shell))) return found
  return ask(shell, ['-i', '-l', '-c'], name, env, timeout)
}
