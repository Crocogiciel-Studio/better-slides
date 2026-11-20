import type { Agent, AgentEvent } from '@better-slide/agents'
import { describe, expect, it } from 'vitest'
import { createApp } from './index.ts'

/** Agent whose run ends when the test says so. */
function controllableAgent() {
  const prompts: string[] = []
  let emit: (e: AgentEvent) => void = () => {}
  const agent: Agent = {
    name: 'fake',
    run(request, onEvent) {
      prompts.push(request.prompt)
      emit = onEvent
      onEvent({ type: 'running' })
      return { cancel() {}, done: Promise.resolve() }
    },
  }
  return { agent, prompts, emit: (e: AgentEvent) => emit(e) }
}

function client(deps = controllableAgent()) {
  const app = createApp({ agent: deps.agent, cwd: '/deck', locate: (_s, text) => (text === 'Intro' ? 14 : undefined) })
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`/__better-slide${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  const add = async (note: string, text = 'Intro') =>
    (await call('POST', '/comments', { slide: 2, text, selector: 'p', note })).json() as Promise<{ id: string }>
  return { ...deps, call, add }
}

describe('review routes', () => {
  it('adds, lists and removes comments in order, enriching the source line', async () => {
    const { call, add } = client()
    const [a, b] = [await add('one'), await add('two', 'Other')]
    await add('three')
    expect((await call('DELETE', `/comments/${b.id}`)).status).toBe(200)
    const { comments } = (await (await call('GET', '/comments')).json()) as { comments: { id: string; line?: number }[] }
    expect(comments.map((c) => c.id)).toEqual([a.id, '3'])
    expect(comments[0].line).toBe(14)
  })

  it('rejects an invalid comment naming the field', async () => {
    const { call } = client()
    const res = await call('POST', '/comments', { slide: 2, text: 'x', selector: 'p' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ field: 'note' })
  })

  it('sends one prompt for the whole stack, then clears and unlocks on success', async () => {
    const t = client()
    await t.add('one')
    await t.add('two', 'Other')
    expect((await t.call('POST', '/send')).status).toBe(202)
    expect(t.prompts).toHaveLength(1)
    expect(t.prompts[0]).toContain('one')
    expect(t.prompts[0]).toContain('two')
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'running' })
    t.emit({ type: 'finished' })
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'finished' })
    expect(await (await t.call('GET', '/comments')).json()).toEqual({ comments: [], locked: false })
  })

  it('locks the stack during a run', async () => {
    const t = client()
    const a = await t.add('one')
    await t.call('POST', '/send')
    expect((await t.call('POST', '/comments', { slide: 1, text: 'x', selector: 'p', note: 'n' })).status).toBe(423)
    expect((await t.call('DELETE', `/comments/${a.id}`)).status).toBe(423)
    expect((await t.call('POST', '/send')).status).toBe(409)
  })

  it('refuses to send an empty stack', async () => {
    const t = client()
    const res = await t.call('POST', '/send')
    expect(res.status).toBe(400)
    expect((await res.json()) as { error: string }).toMatchObject({ error: expect.stringContaining('empty') })
    expect(t.prompts).toHaveLength(0)
  })

  it('reports a failure, keeps the stack and unlocks it', async () => {
    const t = client()
    await t.add('one')
    await t.call('POST', '/send')
    t.emit({ type: 'failed', reason: 'boom' })
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'failed', reason: 'boom' })
    const body = (await (await t.call('GET', '/comments')).json()) as { comments: unknown[]; locked: boolean }
    expect(body.comments).toHaveLength(1)
    expect(body.locked).toBe(false)
  })

  it('streams run status as server-sent events', async () => {
    const t = client()
    await t.add('one')
    const res = await t.call('GET', '/events')
    const reader = res.body!.getReader()
    const read = async () => new TextDecoder().decode((await reader.read()).value)
    expect(await read()).toContain('"state":"idle"')
    await t.call('POST', '/send')
    expect(await read()).toContain('"state":"running"')
    t.emit({ type: 'finished' })
    expect(await read()).toContain('"state":"finished"')
    await reader.cancel()
  })

  it('clearing the stack empties it', async () => {
    const t = client()
    await t.add('one')
    await t.call('DELETE', '/comments')
    expect(await (await t.call('GET', '/comments')).json()).toEqual({ comments: [], locked: false })
  })

  it('refuses to clear the stack while a run is in progress', async () => {
    const t = client()
    await t.add('one')
    await t.call('POST', '/send')
    expect((await t.call('DELETE', '/comments')).status).toBe(423)
  })

  it('cancels the current run through the agent', async () => {
    let cancelled = false
    const t = controllableAgent()
    const run = t.agent.run.bind(t.agent)
    t.agent.run = (req, on) => ({ ...run(req, on), cancel: () => (cancelled = true) })
    const c = client(t)
    await c.add('one')
    await c.call('POST', '/send')
    await c.call('POST', '/cancel')
    expect(cancelled).toBe(true)
  })
})
