import { execFile } from 'node:child_process'

/** Variables that would make an agent CLI bill an API instead of the user's subscription. */
export const STRIPPED_VARIABLES = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const

/** Copy of `parent` without any API-key variable. */
export function buildAgentEnv(parent: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...parent }
  for (const name of STRIPPED_VARIABLES) delete env[name]
  return env
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
