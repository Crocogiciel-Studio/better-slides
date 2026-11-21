import { type Comment, isFinished, isSendable, type StackItem } from '@better-slide/shared'
import type { ReportMark } from './report.ts'

export class StackLockedError extends Error {
  constructor() {
    super('The stack is locked while the agent runs')
  }
}

/**
 * Ordered comments with the outcome of the last run, locked while a run is in progress.
 * A run: `begin()` takes the sendable comments, `report()` applies the agent's markers, then
 * `finish()` or `fail()` closes it so no comment stays in progress.
 */
export function createStack() {
  let items: StackItem[] = []
  let batch = new Set<string>()
  let locked = false
  let counter = 0

  const guard = () => {
    if (locked) throw new StackLockedError()
  }
  const update = (id: string, change: Partial<StackItem>) => {
    items = items.map((i) => (i.id === id ? ({ ...i, ...change } as StackItem) : i))
  }
  const inBatch = () => items.filter((i) => batch.has(i.id))
  const close = (decide: (item: StackItem) => Partial<StackItem> | undefined) => {
    for (const item of inBatch()) {
      const change = decide(item)
      if (change) update(item.id, change)
    }
    batch = new Set()
    locked = false
  }

  return {
    get locked() {
      return locked
    },
    list: (): StackItem[] => [...items],
    add(comment: Comment): StackItem {
      guard()
      const item: StackItem = { ...comment, id: String(++counter), state: 'waiting' }
      items.push(item)
      return item
    },
    /** Returns whether a comment was removed. */
    remove(id: string): boolean {
      guard()
      const before = items.length
      items = items.filter((i) => i.id !== id)
      return items.length < before
    },
    /** Removes the done and unreported comments; the ones still to send stay. */
    clearFinished(): number {
      guard()
      const before = items.length
      items = items.filter((i) => !isFinished(i))
      return before - items.length
    },
    /** Empties the stack and unlocks it. */
    clear() {
      items = []
      batch = new Set()
      locked = false
    },
    /** Locks the stack and returns the comments to send, reset to waiting with no reply. */
    begin(): StackItem[] {
      guard()
      const sent = items.filter(isSendable)
      batch = new Set(sent.map((i) => i.id))
      for (const i of sent) update(i.id, { state: 'waiting', reply: undefined })
      locked = true
      return inBatch()
    },
    /** Applies one marker to a comment of the current run. A start never undoes an outcome; a later outcome wins. */
    report(mark: ReportMark): boolean {
      const item = items.find((i) => i.id === mark.id)
      if (!item || !batch.has(item.id)) return false
      if (mark.kind === 'start') {
        if (item.state !== 'waiting') return false
        update(item.id, { state: 'in-progress' })
      } else {
        update(item.id, { state: mark.kind === 'done' ? 'done' : 'not-done', reply: mark.reply })
      }
      return true
    },
    /** The run ended well: a comment with no outcome is `unreported`, with the agent's final text as its reply. */
    finish(fallback?: string) {
      close((i) => (i.state === 'waiting' || i.state === 'in-progress' ? { state: 'unreported', reply: fallback } : undefined))
    },
    /**
     * The run failed or was cancelled. Outcomes stay. The comment in progress is `failed` with the reason, or back to
     * waiting with `putBack` (a cancel, or a login failure that is not the comment's fault). Comments not started stay waiting.
     */
    fail(reason: string, putBack = false) {
      close((i) => (i.state !== 'in-progress' ? undefined : putBack ? { state: 'waiting' } : { state: 'failed', reply: reason }))
    },
  }
}

export type Stack = ReturnType<typeof createStack>
