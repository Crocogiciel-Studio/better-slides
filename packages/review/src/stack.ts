import type { Comment } from '@better-slide/shared'

export type StackItem = Comment & { id: string }

export class StackLockedError extends Error {
  constructor() {
    super('The stack is locked while the agent runs')
  }
}

/** Ordered pending comments, locked while an agent run is in progress. */
export function createStack() {
  let items: StackItem[] = []
  let locked = false
  let counter = 0

  const guard = () => {
    if (locked) throw new StackLockedError()
  }

  return {
    get locked() {
      return locked
    },
    list: (): StackItem[] => [...items],
    add(comment: Comment): StackItem {
      guard()
      const item = { ...comment, id: String(++counter) }
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
    /** Empties the stack and unlocks it. */
    clear() {
      items = []
      locked = false
    },
    lock() {
      locked = true
    },
    unlock() {
      locked = false
    },
  }
}

export type Stack = ReturnType<typeof createStack>
