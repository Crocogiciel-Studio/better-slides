import type { Agent } from '@better-slide/agents'
import { createApp } from '@better-slide/server'
import { describe, expect, it } from 'vitest'
import { ApiError, BASE, createClient } from './api.ts'

const agent: Agent = { name: 'fake', run: () => ({ cancel() {}, done: Promise.resolve() }) }

function client() {
  const app = createApp({ agent, cwd: '/deck' })
  const fetchFn = ((url: string, init?: RequestInit) => app.request(url, init)) as unknown as typeof fetch
  return createClient(fetchFn, BASE)
}

describe('api client', () => {
  it('reflects the stack and the run status of the server', async () => {
    const api = client()
    const added = await api.add({ slide: 1, text: 'Hello', selector: 'p', note: 'Change' })
    expect((await api.list()).comments).toEqual([added])
    await api.send()
    expect(await api.status()).toEqual({ state: 'running' })
    expect((await api.list()).locked).toBe(true)
    await expect(api.remove(added.id)).rejects.toThrow(ApiError)
  })

  it('surfaces the server message on refusal', async () => {
    await expect(client().send()).rejects.toThrow(/empty/)
  })
})
