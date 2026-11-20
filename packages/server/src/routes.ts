import type { Agent, AgentEvent, AgentRun } from '@better-slide/agents'
import { buildPrompt, createStack, StackLockedError } from '@better-slide/review'
import { validateComment, type RunStatus } from '@better-slide/shared'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

export interface ReviewDeps {
  /** The only way to reach an AI CLI. */
  agent: Agent
  /** Deck folder the agent works in. */
  cwd: string
  /** Best-effort source line of an element's text on a slide. */
  locate?: (slide: number, text: string) => number | undefined
}

export function registerReviewRoutes(app: Hono, deps: ReviewDeps): void {
  const stack = createStack()
  let status: RunStatus = { state: 'idle' }
  let current: AgentRun | undefined
  const listeners = new Set<(s: RunStatus) => void>()

  const setStatus = (next: RunStatus) => {
    status = next
    listeners.forEach((l) => l(next))
  }

  const onEvent = (event: AgentEvent) => {
    if (event.type === 'progress') setStatus({ state: 'running', message: event.message })
    else if (event.type === 'finished') {
      stack.clear()
      setStatus({ state: 'finished' })
    } else if (event.type === 'failed') {
      stack.unlock()
      setStatus({ state: 'failed', reason: event.reason })
    }
  }

  app.get('/comments', (c) => c.json({ comments: stack.list(), locked: stack.locked }))

  app.post('/comments', async (c) => {
    const result = validateComment(await c.req.json().catch(() => null))
    if (!result.ok) return c.json({ error: result.message, field: result.field }, 400)
    const comment = result.comment
    if (comment.line === undefined) {
      const line = deps.locate?.(comment.slide, comment.text)
      if (line) comment.line = line
    }
    try {
      return c.json(stack.add(comment), 201)
    } catch (error) {
      if (error instanceof StackLockedError) return c.json({ error: error.message }, 423)
      throw error
    }
  })

  app.delete('/comments/:id', (c) => {
    try {
      return stack.remove(c.req.param('id')) ? c.json({ ok: true }) : c.json({ error: 'Unknown comment' }, 404)
    } catch (error) {
      if (error instanceof StackLockedError) return c.json({ error: error.message }, 423)
      throw error
    }
  })

  app.delete('/comments', (c) => {
    if (status.state === 'running') return c.json({ error: 'The agent is running' }, 423)
    stack.clear()
    return c.json({ ok: true })
  })

  app.post('/send', (c) => {
    if (status.state === 'running') return c.json({ error: 'A run is already in progress' }, 409)
    const comments = stack.list()
    if (comments.length === 0) return c.json({ error: 'The stack is empty: add a comment before sending' }, 400)
    stack.lock()
    setStatus({ state: 'running' })
    try {
      current = deps.agent.run({ prompt: buildPrompt(comments), cwd: deps.cwd }, onEvent)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      onEvent({ type: 'failed', reason })
      return c.json({ error: reason }, 500)
    }
    return c.json({ ok: true }, 202)
  })

  app.post('/cancel', (c) => {
    current?.cancel()
    return c.json({ ok: true })
  })

  app.get('/status', (c) => c.json(status))

  app.get('/events', (c) =>
    streamSSE(c, async (stream) => {
      const queue: RunStatus[] = [status]
      let wake: (() => void) | undefined
      const listener = (s: RunStatus) => {
        queue.push(s)
        wake?.()
      }
      listeners.add(listener)
      stream.onAbort(() => {
        listeners.delete(listener)
        wake?.()
      })
      while (!stream.aborted) {
        for (let s = queue.shift(); s; s = queue.shift()) await stream.writeSSE({ data: JSON.stringify(s) })
        await new Promise<void>((resolve) => (wake = resolve))
      }
    }),
  )
}
