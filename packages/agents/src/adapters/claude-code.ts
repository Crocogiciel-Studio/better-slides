import { execFile, spawn } from 'node:child_process'
import { basename, isAbsolute, relative } from 'node:path'
import type { Activity, Agent, AgentEvent, AgentReadiness, AgentRequest, AgentRun } from '../agent.ts'
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
  /** Limit for the login check (`claude auth status`). Defaults to 5 s. */
  statusTimeoutMs?: number
}

const LABEL = 'Claude Code'
const LOGIN_HINT = 'run `claude` then `/login`'

/** The readiness results, as the sidebar shows them. */
export const READINESS = {
  ready: { agent: LABEL, ready: true },
  notInstalled: { agent: LABEL, ready: false, reason: 'not-installed', hint: `${LABEL} not found: install it, then ${LOGIN_HINT}` },
  notLoggedIn: { agent: LABEL, ready: false, reason: 'not-logged-in', hint: `Not logged in: ${LOGIN_HINT}` },
  apiBilling: {
    agent: LABEL,
    ready: false,
    reason: 'api-billing',
    hint: `Uses API billing, not your subscription: ${LOGIN_HINT} with your Claude account`,
  },
  /** The login could not be confirmed: sending stays possible, and a login failure at run time is still reported. */
  unknown: { agent: LABEL, ready: true, reason: 'unknown', hint: `Could not confirm the ${LABEL} login; a send fails if it expired` },
} satisfies Record<string, AgentReadiness>

/**
 * Maps `claude auth status --json` to a readiness. Reads only `loggedIn`, `authMethod` and `apiProvider`;
 * the account fields it also prints are never read. Anything unexpected gives `unknown`; this never throws.
 * `loginExpiresAt` is not used: it is not known whether it is the session's limit or a token's.
 */
export function readinessFromAuthStatus(stdout: string): AgentReadiness {
  let status: unknown
  try {
    status = JSON.parse(stdout)
  } catch {
    return READINESS.unknown
  }
  if (!status || typeof status !== 'object') return READINESS.unknown
  const { loggedIn, authMethod, apiProvider } = status as Record<string, unknown>
  if (loggedIn === false) return READINESS.notLoggedIn
  if (loggedIn !== true) return READINESS.unknown
  if (typeof apiProvider === 'string' && apiProvider !== 'firstParty') return READINESS.apiBilling
  if (typeof authMethod !== 'string') return READINESS.unknown
  if (/claude\.ai/i.test(authMethod)) return READINESS.ready
  if (/api|key|console/i.test(authMethod)) return READINESS.apiBilling
  return READINESS.unknown
}

/** The CLI's wording when its login is missing or expired, such as "Failed to authenticate: OAuth session expired". */
const AUTH_ERROR = /authenticat|oauth|\blog ?in\b|\b401\b/i

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
  const findLauncher = async (): Promise<ClaudeCodeOptions['launcher']> =>
    options.launcher ?? (await resolveCommand('claude', { shell: options.shell, env: options.env }).then((command) => (command ? { command } : undefined)))

  return {
    name: 'claude-code',
    async status(): Promise<AgentReadiness> {
      const launcher = await findLauncher()
      if (!launcher) return READINESS.notInstalled
      return new Promise((resolve) => {
        execFile(
          launcher.command,
          [...(launcher.args ?? []), 'auth', 'status', '--json'],
          { env: buildAgentEnv(options.env ?? process.env), timeout: options.statusTimeoutMs ?? 5_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 },
          (error, stdout) => {
            if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return resolve(READINESS.notInstalled)
            // A non-zero exit can still print the status (logged out); a timeout prints nothing and gives unknown.
            resolve(readinessFromAuthStatus(String(stdout ?? '')))
          },
        ).stdin?.end()
      })
    },
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
        const launcher = await findLauncher()
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
            else {
              const reason = reported ?? (stderr.trim() || `agent exited with code ${code}`)
              emit(AUTH_ERROR.test(reason) ? { type: 'failed', reason: `${LABEL} login missing or expired: ${LOGIN_HINT} (${reason.slice(0, 120)})`, kind: 'auth' } : { type: 'failed', reason })
            }
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
