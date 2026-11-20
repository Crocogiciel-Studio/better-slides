import { execFile } from 'node:child_process'

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
}

/**
 * Finds an executable through a login shell: a process launched outside the user's
 * interactive shell lacks its `PATH`. Resolves `undefined` when it is not found.
 */
export function resolveCommand(name: string, options: ResolveOptions = {}): Promise<string | undefined> {
  const env = options.env ?? process.env
  const shell = options.shell ?? env.SHELL ?? '/bin/sh'
  return new Promise((resolve) => {
    execFile(shell, ['-l', '-c', `command -v ${name}`], { env: buildAgentEnv(env), timeout: 10_000 }, (error, stdout) => {
      const lines = stdout.trim().split('\n')
      const path = lines[lines.length - 1]
      resolve(error || !path?.startsWith('/') ? undefined : path)
    })
  })
}
