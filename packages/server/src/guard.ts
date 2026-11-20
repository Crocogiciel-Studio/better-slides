import type { MiddlewareHandler } from 'hono'

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']

export interface GuardOptions {
  /** Extra hostnames the server is reached by (for example Vite's `--host`). Loopback is always allowed. */
  allowedHosts?: string[]
}

/**
 * Keeps other websites from driving the API through the user's browser.
 * - The Host must be loopback or listed: resists DNS rebinding (403).
 * - A present Origin must equal the server's own origin (403). No Origin means a non-browser
 *   client such as curl, which is allowed: only a browser can be steered by a foreign page.
 * - `Sec-Fetch-Site`, when sent, must not be cross-site (403).
 * - State-changing methods require `Content-Type: application/json` (415), which a foreign
 *   form or `text/plain` request cannot send without a CORS preflight.
 * No CORS header is ever set, so a foreign page cannot read any response either.
 */
export function guard(options: GuardOptions = {}): MiddlewareHandler {
  const allowed = new Set([...LOOPBACK, ...(options.allowedHosts ?? []).map((h) => h.toLowerCase())])
  return async (c, next) => {
    const url = new URL(c.req.url)
    if (!allowed.has(url.hostname.toLowerCase())) return c.json({ error: 'Host not allowed' }, 403)

    const origin = c.req.header('origin')
    if (origin !== undefined) {
      let originHost: string | undefined
      try {
        originHost = new URL(origin).host
      } catch {}
      if (originHost !== url.host) return c.json({ error: 'Cross-origin request refused' }, 403)
    }

    const site = c.req.header('sec-fetch-site')
    if (site !== undefined && site !== 'same-origin' && site !== 'none') {
      return c.json({ error: 'Cross-origin request refused' }, 403)
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const type = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase()
      if (type !== 'application/json') return c.json({ error: 'Content-Type must be application/json' }, 415)
    }
    await next()
  }
}
