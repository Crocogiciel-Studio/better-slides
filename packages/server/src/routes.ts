import type { Agent, AgentEvent, AgentRun } from '@better-slide/agents'
import { buildPrompt, createReportReader, createStack, promptId, promptOrder, type ReportMark, StackLockedError, stripMarkers } from '@better-slide/review'
import { isSendable, validateComment, type ReviewSnapshot, type RunStatus } from '@better-slide/shared'
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
  /** Stack ids of the comments sent, in prompt order. */
  let sent: string[] = []
  let reader = createReportReader([])
  const listeners = new Set<(s: ReviewSnapshot) => void>()

  const snapshot = (): ReviewSnapshot => ({ status, comments: stack.list(), locked: stack.locked })
  const publish = () => {
    const s = snapshot()
    listeners.forEach((l) => l(s))
  }
  const setStatus = (next: RunStatus) => {
    status = next
    publish()
  }

  /** Applies the agent's markers; a start also moves the "comment N of M" counter. */
  const apply = (marks: ReportMark[]) => {
    let changed = false
    for (const mark of marks) {
      const id = sent.find((i) => promptId(i) === mark.id)
      if (!id || !stack.report({ ...mark, id })) continue
      changed = true
      if (mark.kind === 'start' && status.state === 'running') status = { ...status, current: { index: sent.indexOf(id) + 1, total: sent.length } }
    }
    if (changed) publish()
  }

  const onEvent = (event: AgentEvent) => {
    if (event.type === 'text') {
      // Each text event is a whole block: it ends a line, so a reply never runs into the next block.
      apply(reader.feed(`${event.text}\n`))
    } else if (event.type === 'activity') {
      if (status.state === 'running') setStatus({ ...status, activity: { action: event.action, ...(event.target ? { target: event.target } : {}) } })
    } else if (event.type === 'finished') {
      apply(reader.flush())
      stack.finish(event.result ? stripMarkers(event.result) : undefined)
      setStatus({ state: 'finished' })
    } else if (event.type === 'failed') {
      apply(reader.flush())
      stack.fail(event.reason, event.kind === 'cancelled')
      setStatus({ state: 'failed', reason: event.reason, ...(event.kind ? { kind: event.kind } : {}) })
    }
  }

  /** Runs a stack change and publishes it; `undefined` when the stack is locked. */
  const mutate = <T>(change: () => T) => {
    try {
      const result = change()
      publish()
      return result
    } catch (error) {
      if (error instanceof StackLockedError) return undefined
      throw error
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
    const item = mutate(() => stack.add(comment))
    return item ? c.json(item, 201) : c.json({ error: new StackLockedError().message }, 423)
  })

  app.delete('/comments/:id', (c) => {
    const removed = mutate(() => stack.remove(c.req.param('id')))
    if (removed === undefined) return c.json({ error: new StackLockedError().message }, 423)
    return removed ? c.json({ ok: true }) : c.json({ error: 'Unknown comment' }, 404)
  })

  /** Removes the comments the agent finished; the ones still to send stay. */
  app.post('/comments/clear-finished', (c) => {
    const removed = mutate(() => stack.clearFinished())
    return removed === undefined ? c.json({ error: new StackLockedError().message }, 423) : c.json({ removed })
  })

  app.delete('/comments', (c) => {
    if (status.state === 'running') return c.json({ error: 'The agent is running' }, 423)
    stack.clear()
    publish()
    return c.json({ ok: true })
  })

  app.post('/send', (c) => {
    if (status.state === 'running') return c.json({ error: 'A run is already in progress' }, 409)
    if (stack.list().length === 0) return c.json({ error: 'The stack is empty: add a comment before sending' }, 400)
    if (!stack.list().some(isSendable)) return c.json({ error: 'Nothing to send: every comment is finished. Clear them or add a comment' }, 400)
    const comments = promptOrder(stack.begin())
    sent = comments.map((i) => i.id)
    reader = createReportReader(sent.map(promptId))
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
      const queue: ReviewSnapshot[] = [snapshot()]
      let wake: (() => void) | undefined
      const listener = (s: ReviewSnapshot) => {
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
