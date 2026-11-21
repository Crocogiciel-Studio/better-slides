import type { AgentReadiness, Comment, ReviewSnapshot, StackItem } from '@better-slide/shared'

export const BASE = '/__better-slide'

export class ApiError extends Error {}

/** Thin client for the server routes. */
export function createClient(fetchFn: typeof fetch = (...a) => fetch(...a), base = BASE) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchFn(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`)
    return data as T
  }
  return {
    list: () => call<{ comments: StackItem[]; locked: boolean }>('GET', '/comments'),
    add: (comment: Omit<Comment, 'line'>) => call<StackItem>('POST', '/comments', comment),
    remove: (id: string) => call<{ ok: true }>('DELETE', `/comments/${id}`),
    clearFinished: () => call<{ removed: number }>('POST', '/comments/clear-finished'),
    /** Whether the agent can run; `refresh` checks again instead of using the server's short cache. */
    agent: (refresh = false) => call<AgentReadiness>('GET', refresh ? '/agent?refresh=1' : '/agent'),
    send: () => call<{ ok: true }>('POST', '/send'),
    cancel: () => call<{ ok: true }>('POST', '/cancel'),
    /** Follows the run status and the comment states. Returns an unsubscribe function. */
    follow(onSnapshot: (s: ReviewSnapshot) => void): () => void {
      const source = new EventSource(`${base}/events`)
      source.onmessage = (e) => onSnapshot(JSON.parse(e.data))
      return () => source.close()
    },
  }
}
