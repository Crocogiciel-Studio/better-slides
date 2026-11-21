import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from './agent.ts'
import { createDefaultAgent, standInLauncher } from './default-agent.ts'

const fake = new URL('../test/fixtures/fake-claude.mjs', import.meta.url).pathname

describe('createDefaultAgent', () => {
  it('runs the stand-in script when BETTER_SLIDE_FAKE_AGENT and the test switch are set', async () => {
    const events: AgentEvent[] = []
    const env = { BETTER_SLIDE_FAKE_AGENT: fake, BETTER_SLIDE_TEST: '1' }
    const run = createDefaultAgent(env).run({ prompt: 'go', cwd: tmpdir() }, (e) => events.push(e))
    await run.done
    expect(events.at(-1)).toMatchObject({ type: 'finished' })
  })
})

describe('standInLauncher', () => {
  it('is honoured with BETTER_SLIDE_TEST=1 or NODE_ENV=test', () => {
    expect(standInLauncher({ BETTER_SLIDE_FAKE_AGENT: fake, BETTER_SLIDE_TEST: '1' })?.args).toEqual([fake])
    expect(standInLauncher({ BETTER_SLIDE_FAKE_AGENT: fake, NODE_ENV: 'test' })?.args).toEqual([fake])
  })

  it('is ignored without a test switch', () => {
    expect(standInLauncher({ BETTER_SLIDE_FAKE_AGENT: fake })).toBeUndefined()
    expect(standInLauncher({ BETTER_SLIDE_FAKE_AGENT: fake, NODE_ENV: 'production' })).toBeUndefined()
  })
})
