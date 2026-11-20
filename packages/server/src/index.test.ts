import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createMiddleware } from './index.ts'

let server: Server

async function start(): Promise<string> {
  const middleware = createMiddleware()
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 200
      res.end('deck')
    }),
  )
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(() => new Promise((r) => server.close(r)))

describe('server middleware', () => {
  it('answers the ping route with JSON', async () => {
    const base = await start()
    const res = await fetch(`${base}/__better-slide/ping`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('passes requests outside the prefix on', async () => {
    const base = await start()
    expect(await (await fetch(`${base}/1`)).text()).toBe('deck')
  })

  it('answers not found for an unknown route under the prefix', async () => {
    const base = await start()
    expect((await fetch(`${base}/__better-slide/nope`)).status).toBe(404)
  })
})
