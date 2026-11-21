import { request as httpRequest } from 'node:http'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, createMiddleware } from './index.ts'

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

describe('request guard over raw HTTP', () => {
  const comment = JSON.stringify({ slide: 1, text: 'Hi', selector: 'p', note: 'n' })
  const raw = (base: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: string }) =>
    new Promise<{ status: number; headers: Record<string, unknown> }>((resolve, reject) => {
      const url = new URL(base)
      const req = httpRequest(
        { host: url.hostname, port: url.port, path: `/__better-slide${path}`, method: init.method ?? 'GET', headers: init.headers },
        (res) => {
          res.resume()
          res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }))
        },
      )
      req.on('error', reject)
      req.end(init.body)
    })
  const post = (base: string, headers: Record<string, string>, path = '/comments') =>
    raw(base, path, { method: 'POST', headers, body: comment })

  async function startApp(): Promise<string> {
    const middleware = createMiddleware(createApp({ agent: { name: 'f', run: () => ({ cancel() {}, done: Promise.resolve() }) }, cwd: '/d' }))
    server = createServer((req, res) => middleware(req, res, () => res.end('deck')))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  it('accepts a same-origin JSON request', async () => {
    const base = await startApp()
    const res = await post(base, { 'content-type': 'application/json', origin: base })
    expect(res.status).toBe(201)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('accepts a request without Origin (non-browser client such as curl)', async () => {
    const base = await startApp()
    expect((await post(base, { 'content-type': 'application/json' })).status).toBe(201)
  })

  it('refuses a foreign Origin with 403 on write and read routes', async () => {
    const base = await startApp()
    const headers = { 'content-type': 'application/json', origin: 'http://evil.example' }
    expect((await post(base, headers)).status).toBe(403)
    expect((await post(base, headers, '/send')).status).toBe(403)
    expect((await raw(base, '/comments', { headers: { origin: 'http://evil.example' } })).status).toBe(403)
    expect((await raw(base, '/events', { headers: { origin: 'http://evil.example' } })).status).toBe(403)
  })

  it('refuses a cross-site fetch without Origin', async () => {
    const base = await startApp()
    expect((await raw(base, '/status', { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403)
  })

  it('refuses a non-JSON content type with 415', async () => {
    const base = await startApp()
    expect((await post(base, { 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post(base, { 'content-type': 'text/plain' }, '/send')).status).toBe(415)
    expect((await post(base, {})).status).toBe(415)
  })

  it('refuses a foreign Host with 403 (DNS rebinding)', async () => {
    const base = await startApp()
    const res = await raw(base, '/comments', { headers: { host: 'evil.example' } })
    expect(res.status).toBe(403)
  })

  it('stays loopback-only: a network host name is refused, so --host cannot expose the API', async () => {
    const base = await startApp()
    for (const host of ['192.168.1.20:5173', 'my-laptop.local:5173', '0.0.0.0:5173']) {
      expect((await raw(base, '/comments', { headers: { host } })).status).toBe(403)
    }
    expect((await raw(base, '/comments', { headers: { host: 'localhost:5173' } })).status).toBe(200)
  })
})
