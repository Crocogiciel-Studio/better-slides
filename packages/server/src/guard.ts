import type { MiddlewareHandler } from 'hono'

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']

/**
 * Keeps other websites from driving the API through the user's browser.
 * - The Host must be loopback: resists DNS rebinding (403). The API is loopback-only, so a deck served
 *   on the network (`--host`) cannot use it.
 * - A present Origin must equal the server's own origin (403). No Origin means a non-browser
 *   client such as curl, which is allowed: only a browser can be steered by a foreign page.
 * - `Sec-Fetch-Site`, when sent, must not be cross-site (403).
 * - State-changing methods require `Content-Type: application/json` (415), which a foreign
 *   form or `text/plain` request cannot send without a CORS preflight.
 * No CORS header is ever set, so a foreign page cannot read any response either.
 */
export function guard(): MiddlewareHandler {
  return async (c, next) => {
    const url = new URL(c.req.url)
    if (!LOOPBACK.includes(url.hostname.toLowerCase())) return c.json({ error: 'Host not allowed' }, 403)

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
