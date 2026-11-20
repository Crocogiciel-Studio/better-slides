import type { Agent } from './agent.ts'
import { createClaudeCodeAgent } from './adapters/claude-code.ts'

/**
 * The agent Better Slide runs by default. Callers never name a CLI.
 * `BETTER_SLIDE_FAKE_AGENT` (a script path) swaps the CLI for a stand-in in tests.
 */
export function createDefaultAgent(env: NodeJS.ProcessEnv = process.env): Agent {
  const fake = env.BETTER_SLIDE_FAKE_AGENT
  return createClaudeCodeAgent(fake ? { launcher: { command: process.execPath, args: [fake] } } : {})
}
