import { getRequestListener } from '@hono/node-server'
import { Hono } from 'hono'
import { registerReviewRoutes, type ReviewDeps } from './routes.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type { ReviewDeps, RunStatus } from './routes.ts'

export const API_PREFIX = '/__better-slide'

export type Next = (error?: unknown) => void
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => void

export function createApp(deps?: ReviewDeps): Hono {
  const app = new Hono().basePath(API_PREFIX)
  app.get('/ping', (c) => c.json({ ok: true }))
  if (deps) registerReviewRoutes(app, deps)
  return app
}

/** Vite/Connect middleware: handles `API_PREFIX` requests, passes every other request on. */
export function createMiddleware(app: Hono = createApp()): Middleware {
  const listener = getRequestListener(app.fetch)
  return (req, res, next) => {
    const path = (req.url ?? '').split('?')[0]
    if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
      void listener(req, res)
    } else {
      next()
    }
  }
}
