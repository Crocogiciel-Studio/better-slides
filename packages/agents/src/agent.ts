import type { Activity, AgentReadiness } from '@better-slide/shared'

export type { Activity, AgentReadiness } from '@better-slide/shared'

/** Progress of one agent run, with no CLI-specific detail. */
export type AgentEvent =
  | { type: 'running' }
  /** Text the agent wrote, as it arrives. Report markers are read from here only. */
  | { type: 'text'; text: string }
  /** A tool call, such as reading or editing a file. */
  | ({ type: 'activity' } & Activity)
  /** `result` is the agent's final text, when it gave one. */
  | { type: 'finished'; result?: string }
  /** `kind` is `cancelled` after `cancel()`, `auth` when the CLI is not logged in. */
  | { type: 'failed'; reason: string; kind?: 'cancelled' | 'auth' }

export interface AgentRequest {
  prompt: string
  /** Folder of the deck the agent edits. */
  cwd: string
}

export interface AgentRun {
  /** Stops the run. A cancelled run ends with a `failed` event of kind `cancelled`. */
  cancel(): void
  /** Settles after the last event was emitted. Never rejects. */
  done: Promise<void>
}

/** A coding agent. Implementations hide which CLI runs. */
export interface Agent {
  readonly name: string
  run(request: AgentRequest, onEvent: (event: AgentEvent) => void): AgentRun
  /** Whether a run can start now: installed, logged in, on the user's subscription. Never rejects. */
  status?(): Promise<AgentReadiness>
}
