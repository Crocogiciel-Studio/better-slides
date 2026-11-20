import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from './agent.ts'
import { createDefaultAgent } from './default-agent.ts'

const fake = new URL('../test/fixtures/fake-claude.mjs', import.meta.url).pathname

describe('createDefaultAgent', () => {
  it('runs the stand-in script when BETTER_SLIDE_FAKE_AGENT is set', async () => {
    const events: AgentEvent[] = []
    const run = createDefaultAgent({ BETTER_SLIDE_FAKE_AGENT: fake }).run({ prompt: 'go', cwd: tmpdir() }, (e) => events.push(e))
    await run.done
    expect(events.at(-1)).toEqual({ type: 'finished' })
  })
})
