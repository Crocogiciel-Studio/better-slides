import { spawn } from 'node:child_process'
import { basename, isAbsolute, relative } from 'node:path'
import type { Activity, Agent, AgentEvent, AgentRequest, AgentRun } from '../agent.ts'
import { buildAgentEnv, resolveCommand } from '../environment.ts'

export interface ClaudeCodeOptions {
  /** Replaces the installed CLI (tests use a fake script). */
  launcher?: { command: string; args?: string[] }
  env?: NodeJS.ProcessEnv
  /** Login shell used to find the CLI. */
  shell?: string
  /** A run still going after this long is stopped and fails. Defaults to 10 minutes. */
  timeoutMs?: number
  /** Wait between SIGTERM and SIGKILL when stopping a run. Defaults to 3 s. */
  killGraceMs?: number
}

const DEFAULT_TIMEOUT_MS = 10 * 60_000
const DEFAULT_KILL_GRACE_MS = 3_000

const CLI_ARGS = [
  '-p',
  '--output-format',
  'stream-json',
  '--verbose',
  '--permission-mode',
  'acceptEdits',
  '--allowedTools',
  'Read,Edit,Write,Glob,Grep',
]

const MAX_TEXT_LENGTH = 10_000
const MAX_TARGET_LENGTH = 80

/** Claude Code tool names, by generic action. Anything else is `other`. */
const TOOL_ACTIONS: Record<string, Activity['action']> = {
  Read: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Grep: 'search',
  Glob: 'search',
  LS: 'search',
}

/** A path relative to the deck, or its base name when outside: never an absolute path of the author's machine. */
function displayPath(path: string, cwd: string): string {
  const rel = relative(cwd, path)
  const shown = !rel || rel.startsWith('..') || isAbsolute(rel) ? basename(path) : rel
  return shown.slice(0, MAX_TARGET_LENGTH)
}

function activityOf(tool: { name?: unknown; input?: unknown }, cwd: string): AgentEvent {
  const input = tool.input && typeof tool.input === 'object' ? (tool.input as Record<string, unknown>) : undefined
  const action = typeof tool.name === 'string' ? TOOL_ACTIONS[tool.name] : undefined
  if (!input || !action) return { type: 'activity', action: 'other' }
  const path = [input.file_path, input.notebook_path, input.path].find((v): v is string => typeof v === 'string' && v !== '')
  if (action === 'search' && typeof input.pattern === 'string') {
    const pattern = isAbsolute(input.pattern) ? basename(input.pattern) : input.pattern
    return { type: 'activity', action, target: pattern.slice(0, MAX_TARGET_LENGTH) }
  }
  return path ? { type: 'activity', action, target: displayPath(path, cwd) } : { type: 'activity', action }
}

/**
 * Maps one line of `--output-format stream-json` to generic events. Assumed shapes, unverified against a
 * real run (decision 0002): `assistant` with `message.content[]` of `text` and `tool_use` items, and `result`
 * with `result` and `is_error`. Anything else, or anything malformed, is ignored; this never throws.
 */
export function parseStreamLine(line: string, cwd: string): { events: AgentEvent[]; result?: string; error?: string } {
  let event: unknown
  try {
    event = JSON.parse(line)
  } catch {
    return { events: [] }
  }
  if (!event || typeof event !== 'object') return { events: [] }
  const e = event as Record<string, unknown>
  if (e.type === 'assistant') {
    const message = e.message as { content?: unknown } | undefined
    const content = Array.isArray(message?.content) ? message.content : []
    const events: AgentEvent[] = []
    for (const item of content) {
      if (!item || typeof item !== 'object') continue
      if (item.type === 'text' && typeof item.text === 'string' && item.text) events.push({ type: 'text', text: item.text.slice(0, MAX_TEXT_LENGTH) })
      else if (item.type === 'tool_use') events.push(activityOf(item, cwd))
    }
    return { events }
  }
  if (e.type === 'result') {
    const text = typeof e.result === 'string' ? e.result : undefined
    return e.is_error === true ? { events: [], error: text ?? 'agent reported an error' } : { events: [], result: text }
  }
  return { events: [] }
}

/** Runs the user's installed Claude Code CLI headless, on their own login. */
export function createClaudeCodeAgent(options: ClaudeCodeOptions = {}): Agent {
  return {
    name: 'claude-code',
    run(request: AgentRequest, onEvent: (event: AgentEvent) => void): AgentRun {
      let child: ReturnType<typeof spawn> | undefined
      let cancelled = false
      let timedOut = false
      let killTimer: NodeJS.Timeout | undefined
      let settled = false
      const emit = (event: AgentEvent) => {
        if (settled) return
        if (event.type === 'finished' || event.type === 'failed') settled = true
        onEvent(event)
      }

      /** SIGTERM now, SIGKILL if the process is still alive after the grace period. */
      const stop = () => {
        if (!child || child.exitCode !== null || killTimer) return
        child.kill('SIGTERM')
        killTimer = setTimeout(() => child?.kill('SIGKILL'), options.killGraceMs ?? DEFAULT_KILL_GRACE_MS)
      }

      const done = (async () => {
        const launcher: ClaudeCodeOptions['launcher'] =
          options.launcher ??
          (await resolveCommand('claude', { shell: options.shell, env: options.env }).then((command) =>
            command ? { command } : undefined,
          ))
        if (!launcher) return emit({ type: 'failed', reason: 'claude CLI not found: install Claude Code and log in' })
        if (cancelled) return emit({ type: 'failed', reason: 'cancelled', kind: 'cancelled' })

        await new Promise<void>((resolve) => {
          const proc = spawn(launcher.command, [...(launcher.args ?? []), ...CLI_ARGS], {
            cwd: request.cwd,
            env: buildAgentEnv(options.env ?? process.env),
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          child = proc
          const runTimer = setTimeout(() => {
            timedOut = true
            stop()
          }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
          let stderr = ''
          let reported: string | undefined
          let result: string | undefined
          let buffer = ''
          const handle = (line: string) => {
            const parsed = parseStreamLine(line, request.cwd)
            parsed.events.forEach(emit)
            if (parsed.error) reported = parsed.error
            if (parsed.result !== undefined) result = parsed.result
          }
          proc.stderr.on('data', (chunk) => (stderr = (stderr + chunk).slice(-500)))
          proc.stdout.setEncoding('utf8') // a character split across chunks stays whole
          proc.stdout.on('data', (chunk: string) => {
            buffer += chunk
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            lines.forEach(handle)
          })
          proc.on('error', (error: NodeJS.ErrnoException) => {
            clearTimeout(runTimer)
            emit({ type: 'failed', reason: error.code === 'ENOENT' ? 'claude CLI not found' : error.message })
            resolve()
          })
          proc.on('close', (code) => {
            clearTimeout(runTimer)
            clearTimeout(killTimer)
            if (buffer) handle(buffer) // a last line with no newline
            if (cancelled) emit({ type: 'failed', reason: 'cancelled', kind: 'cancelled' })
            else if (timedOut) emit({ type: 'failed', reason: `agent timed out after ${Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)} s` })
            else if (code === 0 && !reported) emit({ type: 'finished', result })
            else emit({ type: 'failed', reason: reported ?? (stderr.trim() || `agent exited with code ${code}`) })
            resolve()
          })
          proc.stdin.on('error', () => {})
          proc.stdin.end(request.prompt)
          emit({ type: 'running' })
        })
      })()

      return {
        done,
        cancel() {
          cancelled = true
          stop()
        },
      }
    },
  }
}
