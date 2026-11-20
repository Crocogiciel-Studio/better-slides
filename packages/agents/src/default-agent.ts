import type { Agent } from './agent.ts'
import { createClaudeCodeAgent } from './adapters/claude-code.ts'

/** The stand-in launcher, only when a test switch is set: a stray variable must never replace the real CLI. */
export function standInLauncher(env: NodeJS.ProcessEnv): { command: string; args: string[] } | undefined {
  const script = env.BETTER_SLIDE_FAKE_AGENT
  const testing = env.BETTER_SLIDE_TEST === '1' || env.NODE_ENV === 'test'
  return script && testing ? { command: process.execPath, args: [script] } : undefined
}

/**
 * The agent Better Slide runs by default. Callers never name a CLI.
 * `BETTER_SLIDE_FAKE_AGENT` (a script path) swaps the CLI for a stand-in, only with
 * `BETTER_SLIDE_TEST=1` or `NODE_ENV=test`.
 */
export function createDefaultAgent(env: NodeJS.ProcessEnv = process.env): Agent {
  const launcher = standInLauncher(env)
  return createClaudeCodeAgent(launcher ? { launcher } : {})
}
