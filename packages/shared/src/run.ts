import type { Comment } from './comment.ts'

/**
 * Where a comment stands. `waiting`, `not-done` and `failed` are sent on the next send;
 * `done` and `unreported` (the run ended without a reply for it) wait for "Clear finished".
 */
export type CommentState = 'waiting' | 'in-progress' | 'done' | 'not-done' | 'failed' | 'unreported'

/** Sent on the next send. */
export const isSendable = (item: { state: CommentState }) => item.state === 'waiting' || item.state === 'not-done' || item.state === 'failed'
/** Removed by "Clear finished". */
export const isFinished = (item: { state: CommentState }) => item.state === 'done' || item.state === 'unreported'

/** A comment in the review stack, with the outcome of the last run that carried it. */
export type StackItem = Comment & {
  id: string
  state: CommentState
  /** The agent's one-line reply, the failure reason, or its final text as a fallback. */
  reply?: string
}

/** What the agent is doing, with no CLI-specific detail. `target` is a path relative to the deck, or a search pattern. */
export interface Activity {
  action: 'read' | 'edit' | 'search' | 'other'
  target?: string
}

/** State of the agent run, as the server reports it. */
export type RunStatus =
  | { state: 'idle' }
  | {
      state: 'running'
      activity?: Activity
      /** 1-based position, in prompt order, of the comment the agent last started, out of the comments sent. */
      current?: { index: number; total: number }
    }
  | { state: 'finished' }
  | { state: 'failed'; reason: string; kind?: 'cancelled' }

/** Everything the sidebar shows, pushed on every change. */
export interface ReviewSnapshot {
  status: RunStatus
  comments: StackItem[]
  locked: boolean
}
