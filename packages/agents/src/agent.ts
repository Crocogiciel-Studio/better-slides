/** Progress of one agent run. */
export type AgentEvent =
  | { type: 'running' }
  | { type: 'progress'; message: string }
  | { type: 'finished' }
  | { type: 'failed'; reason: string }

export interface AgentRequest {
  prompt: string
  /** Folder of the deck the agent edits. */
  cwd: string
}

export interface AgentRun {
  /** Stops the run. A cancelled run ends with a `failed` event. */
  cancel(): void
  /** Settles after the last event was emitted. Never rejects. */
  done: Promise<void>
}

/** A coding agent. Implementations hide which CLI runs. */
export interface Agent {
  readonly name: string
  run(request: AgentRequest, onEvent: (event: AgentEvent) => void): AgentRun
}
