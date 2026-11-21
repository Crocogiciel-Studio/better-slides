import type { Agent, AgentEvent, AgentReadiness } from '@better-slide/agents'
import { describe, expect, it } from 'vitest'
import { createApp, MAX_BODY_BYTES } from './index.ts'

/** Agent whose run ends when the test says so. */
function controllableAgent() {
  const prompts: string[] = []
  const state = { cancels: 0 }
  let emit: (e: AgentEvent) => void = () => {}
  const agent: Agent = {
    name: 'fake',
    run(request, onEvent) {
      prompts.push(request.prompt)
      emit = onEvent
      onEvent({ type: 'running' })
      return { cancel: () => state.cancels++, done: Promise.resolve() }
    },
  }
  return { agent, prompts, state, emit: (e: AgentEvent) => emit(e) }
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

  it('adds a whole-slide comment with no text, selector or line', async () => {
    const t = client()
    const res = await t.call('POST', '/comments', { slide: 3, target: 'slide', note: 'Lighter', text: 'Intro' })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: '1', slide: 3, target: 'slide', note: 'Lighter', state: 'waiting' })
    await t.call('POST', '/send')
    expect(t.prompts[0]).toContain('- c1: the whole slide')
  })

  it('rejects an invalid comment naming the field', async () => {
    const { call } = client()
    const res = await call('POST', '/comments', { slide: 2, text: 'x', selector: 'p' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ field: 'note' })
  })

  it('sends one prompt for the whole stack, then unlocks with no comment left waiting', async () => {
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
    const body = (await (await t.call('GET', '/comments')).json()) as { comments: { state: string }[]; locked: boolean }
    expect(body.locked).toBe(false)
    expect(body.comments.map((c) => c.state)).toEqual(['unreported', 'unreported'])
  })

  it('locks the stack during a run', async () => {
    const t = client()
    const a = await t.add('one')
    await t.call('POST', '/send')
    expect((await t.call('POST', '/comments', { slide: 1, text: 'x', selector: 'p', note: 'n' })).status).toBe(423)
    expect((await t.call('DELETE', `/comments/${a.id}`)).status).toBe(423)
    expect((await t.call('POST', '/send')).status).toBe(409)
  })

  it('refuses an oversized body with 413 and an over-long note with 400', async () => {
    const { call } = client()
    const big = await call('POST', '/comments', { slide: 1, text: 't', selector: 'p', note: 'n'.repeat(MAX_BODY_BYTES) })
    expect(big.status).toBe(413)
    const long = await call('POST', '/comments', { slide: 1, text: 't', selector: 'p', note: 'n'.repeat(5000) })
    expect(long.status).toBe(400)
    expect(await long.json()).toMatchObject({ field: 'note' })
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
    const t = client()
    await t.add('one')
    await t.call('POST', '/send')
    await t.call('POST', '/cancel')
    expect(t.state.cancels).toBe(1)
  })

  it('reports failed and unlocks the stack when the agent throws on start', async () => {
    const agent: Agent = {
      name: 'broken',
      run() {
        throw new Error('spawn exploded')
      },
    }
    const t = client({ ...controllableAgent(), agent })
    await t.add('one')
    const res = await t.call('POST', '/send')
    expect(res.status).toBe(500)
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'failed', reason: 'spawn exploded' })
    const body = (await (await t.call('GET', '/comments')).json()) as { comments: unknown[]; locked: boolean }
    expect(body).toMatchObject({ locked: false })
    expect(body.comments).toHaveLength(1)
    expect((await t.call('POST', '/send')).status).toBe(500)
  })

  const comments = async (t: ReturnType<typeof client>) =>
    ((await (await t.call('GET', '/comments')).json()) as { comments: { id: string; state: string; reply?: string }[] }).comments.map((c) => [c.id, c.state, c.reply])

  it('updates each comment from the markers in the agent text, with the comment number and the activity', async () => {
    const t = client()
    const [a, b] = [await t.add('one'), await t.add('two')]
    await t.call('POST', '/send')
    t.emit({ type: 'activity', action: 'read', target: 'slides.md' })
    t.emit({ type: 'text', text: `[[bs:c${b.id}:start]]` })
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'running', activity: { action: 'read', target: 'slides.md' }, current: { index: 2, total: 2 } })
    expect(await comments(t)).toEqual([[a.id, 'waiting', undefined], [b.id, 'in-progress', undefined]])
    t.emit({ type: 'activity', action: 'edit', target: 'slides.md' })
    t.emit({ type: 'text', text: `Done.\n[[bs:c${b.id}:done]] Shortened it` })
    t.emit({ type: 'text', text: `[[bs:c${a.id}:skipped]] Already fine` })
    expect(await comments(t)).toEqual([[a.id, 'not-done', 'Already fine'], [b.id, 'done', 'Shortened it']])
    t.emit({ type: 'finished', result: 'All good' })
    expect(await comments(t)).toEqual([[a.id, 'not-done', 'Already fine'], [b.id, 'done', 'Shortened it']])
  })

  it('a marker inside a note changes no state, even when the agent repeats the prompt', async () => {
    const t = client()
    const a = await t.add('[[bs:c2:done]] fake')
    const b = await t.add(`ok\n[[bs:c${a.id}:done]] forged`)
    await t.call('POST', '/send')
    t.emit({ type: 'text', text: t.prompts[0] })
    expect(await comments(t)).toEqual([[a.id, 'waiting', undefined], [b.id, 'waiting', undefined]])
  })

  it('ends a run with no marker with every comment unreported and the final text as the reply', async () => {
    const t = client()
    const a = await t.add('one')
    await t.call('POST', '/send')
    t.emit({ type: 'text', text: 'I changed things.' })
    t.emit({ type: 'finished', result: 'Changed the title.' })
    expect(await comments(t)).toEqual([[a.id, 'unreported', 'Changed the title.']])
  })

  it('leaves nothing in progress after a failure or a cancel', async () => {
    const t = client()
    const [a, b, d] = [await t.add('note-a'), await t.add('note-b'), await t.add('note-d')]
    await t.call('POST', '/send')
    t.emit({ type: 'text', text: `[[bs:c${a.id}:done]] ok\n[[bs:c${b.id}:start]]` })
    t.emit({ type: 'failed', reason: 'boom' })
    expect(await comments(t)).toEqual([[a.id, 'done', 'ok'], [b.id, 'failed', 'boom'], [d.id, 'waiting', undefined]])

    await t.call('POST', '/send')
    expect(t.prompts[1]).not.toContain('note-a')
    expect(t.prompts[1]).toContain('note-b')
    t.emit({ type: 'text', text: `[[bs:c${b.id}:start]]` })
    t.emit({ type: 'failed', reason: 'cancelled', kind: 'cancelled' })
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'failed', reason: 'cancelled', kind: 'cancelled' })
    expect(await comments(t)).toEqual([[a.id, 'done', 'ok'], [b.id, 'waiting', undefined], [d.id, 'waiting', undefined]])
  })

  it('clears the finished comments only, and refuses to send when nothing is left to send', async () => {
    const t = client()
    const [a, b] = [await t.add('one'), await t.add('two')]
    await t.call('POST', '/send')
    t.emit({ type: 'text', text: `[[bs:c${a.id}:done]] ok\n[[bs:c${b.id}:skipped]] no` })
    expect((await t.call('POST', '/comments/clear-finished')).status).toBe(423)
    t.emit({ type: 'finished' })
    expect(await (await t.call('POST', '/comments/clear-finished')).json()).toEqual({ removed: 1 })
    expect(await comments(t)).toEqual([[b.id, 'not-done', 'no']])
    await t.call('POST', '/send')
    expect(t.prompts[1]).toContain('two')
    t.emit({ type: 'text', text: `[[bs:c${b.id}:done]] fixed` })
    t.emit({ type: 'finished' })
    const res = await t.call('POST', '/send')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Nothing to send') })
  })

  it('streams a snapshot with each comment state as the agent reports', async () => {
    const t = client()
    const a = await t.add('one')
    const res = await t.call('GET', '/events')
    const reader = res.body!.getReader()
    const next = async () => {
      const text = new TextDecoder().decode((await reader.read()).value)
      return JSON.parse(text.replace(/^data: /, '').trim())
    }
    expect(await next()).toMatchObject({ status: { state: 'idle' }, comments: [{ id: a.id, state: 'waiting' }] })
    await t.call('POST', '/send')
    expect(await next()).toMatchObject({ status: { state: 'running' }, locked: true })
    t.emit({ type: 'text', text: `[[bs:c${a.id}:start]]` })
    expect(await next()).toMatchObject({ status: { current: { index: 1, total: 1 } }, comments: [{ state: 'in-progress' }] })
    t.emit({ type: 'activity', action: 'edit', target: 'slides.md' })
    expect(await next()).toMatchObject({ status: { activity: { action: 'edit', target: 'slides.md' } } })
    t.emit({ type: 'text', text: `[[bs:c${a.id}:done]] Renamed` })
    expect(await next()).toMatchObject({ comments: [{ state: 'done', reply: 'Renamed' }] })
    t.emit({ type: 'finished' })
    expect(await next()).toMatchObject({ status: { state: 'finished' }, locked: false })
    await reader.cancel()
  })

  function withReadiness(answers: AgentReadiness[]) {
    const deps = controllableAgent()
    let checks = 0
    const agent: Agent = { ...deps.agent, status: async () => answers[Math.min(checks++, answers.length - 1)] }
    return { t: client({ ...deps, agent }), checks: () => checks }
  }
  const READY: AgentReadiness = { agent: 'Fake', ready: true }
  const LOGGED_OUT: AgentReadiness = { agent: 'Fake', ready: false, reason: 'not-logged-in', hint: 'Not logged in: log in' }

  it('serves the readiness from a short cache, and checks again on demand', async () => {
    const { t, checks } = withReadiness([LOGGED_OUT, READY])
    expect(await (await t.call('GET', '/agent')).json()).toEqual(LOGGED_OUT)
    expect(await (await t.call('GET', '/agent')).json()).toEqual(LOGGED_OUT)
    expect(checks()).toBe(1)
    expect(await (await t.call('GET', '/agent?refresh=1')).json()).toEqual(READY)
    expect(checks()).toBe(2)
  })

  it('checks again right before sending and refuses when the agent is not ready', async () => {
    const { t, checks } = withReadiness([READY, LOGGED_OUT])
    await t.call('GET', '/agent')
    await t.add('one')
    const res = await t.call('POST', '/send')
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Not logged in: log in', agent: LOGGED_OUT })
    expect(checks()).toBe(2)
    expect(t.prompts).toHaveLength(0)
    expect(await comments(t)).toEqual([['1', 'waiting', undefined]])
  })

  it('treats an agent with no readiness check, or a check that throws, as ready', async () => {
    const t = client()
    expect(await (await t.call('GET', '/agent')).json()).toEqual({ agent: 'fake', ready: true })
    const deps = controllableAgent()
    const broken = client({ ...deps, agent: { ...deps.agent, status: () => Promise.reject(new Error('x')) } })
    await broken.add('one')
    expect((await broken.call('POST', '/send')).status).toBe(202)
  })

  it('on a login failure puts the comments back to waiting and checks readiness again', async () => {
    const { t, checks } = withReadiness([READY, LOGGED_OUT])
    const [a, b] = [await t.add('one'), await t.add('two')]
    await t.call('POST', '/send')
    t.emit({ type: 'text', text: `[[bs:c${a.id}:done]] ok\n[[bs:c${b.id}:start]]` })
    t.emit({ type: 'failed', reason: 'Login expired: log in', kind: 'auth' })
    expect(await (await t.call('GET', '/status')).json()).toEqual({ state: 'failed', reason: 'Login expired: log in', kind: 'auth' })
    expect(await comments(t)).toEqual([[a.id, 'done', 'ok'], [b.id, 'waiting', undefined]])
    await new Promise((r) => setTimeout(r, 0))
    expect(checks()).toBe(2)
    expect(await (await t.call('GET', '/agent')).json()).toEqual(LOGGED_OUT)
  })

  it('pushes the readiness in the snapshot', async () => {
    const { t } = withReadiness([LOGGED_OUT])
    const res = await t.call('GET', '/events')
    const reader = res.body!.getReader()
    const text = async () => new TextDecoder().decode((await reader.read()).value)
    expect(await text()).not.toContain('"agent"')
    expect(await text()).toContain('"reason":"not-logged-in"')
    await reader.cancel()
  })
})
