import type { Comment } from '@better-slide/shared'

export type StackItem = Comment & { id: string }
export type RunStatus =
  | { state: 'idle' }
  | { state: 'running'; message?: string }
  | { state: 'finished' }
  | { state: 'failed'; reason: string }

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
    send: () => call<{ ok: true }>('POST', '/send'),
    status: () => call<RunStatus>('GET', '/status'),
    /** Follows run status. Returns an unsubscribe function. */
    follow(onStatus: (s: RunStatus) => void): () => void {
      const source = new EventSource(`${base}/events`)
      source.onmessage = (e) => onStatus(JSON.parse(e.data))
      return () => source.close()
    },
  }
}
