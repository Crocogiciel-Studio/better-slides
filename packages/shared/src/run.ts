import type { Comment } from './comment.ts'

/** A comment waiting in the review stack. */
export type StackItem = Comment & { id: string }

/** State of the agent run, as the server reports it. */
export type RunStatus =
  | { state: 'idle' }
  | { state: 'running'; message?: string }
  | { state: 'finished' }
  | { state: 'failed'; reason: string }
