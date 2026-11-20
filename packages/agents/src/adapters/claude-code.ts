import { spawn } from 'node:child_process'
import type { Agent, AgentEvent, AgentRequest, AgentRun } from '../agent.ts'
import { buildAgentEnv, resolveCommand } from '../environment.ts'

export interface ClaudeCodeOptions {
  /** Replaces the installed CLI (tests use a fake script). */
  launcher?: { command: string; args?: string[] }
  env?: NodeJS.ProcessEnv
  /** Login shell used to find the CLI. */
  shell?: string
}

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

function textOf(line: string): { message?: string; error?: string } {
  try {
    const event = JSON.parse(line)
    if (event.type === 'assistant') {
      const text = (event.message?.content ?? []).find((c: { type: string }) => c.type === 'text')?.text
      return text ? { message: String(text).slice(0, 200) } : {}
    }
    if (event.type === 'result' && event.is_error) return { error: String(event.result ?? 'agent reported an error') }
  } catch {
    // Not JSON: ignore the line.
  }
  return {}
}

/** Runs the user's installed Claude Code CLI headless, on their own login. */
export function createClaudeCodeAgent(options: ClaudeCodeOptions = {}): Agent {
  return {
    name: 'claude-code',
    run(request: AgentRequest, onEvent: (event: AgentEvent) => void): AgentRun {
      let child: ReturnType<typeof spawn> | undefined
      let cancelled = false
      let settled = false
      const emit = (event: AgentEvent) => {
        if (settled) return
        if (event.type === 'finished' || event.type === 'failed') settled = true
        onEvent(event)
      }

      const done = (async () => {
        const launcher: ClaudeCodeOptions['launcher'] =
          options.launcher ??
          (await resolveCommand('claude', { shell: options.shell, env: options.env }).then((command) =>
            command ? { command } : undefined,
          ))
        if (!launcher) return emit({ type: 'failed', reason: 'claude CLI not found: install Claude Code and log in' })
        if (cancelled) return emit({ type: 'failed', reason: 'cancelled' })

        await new Promise<void>((resolve) => {
          const proc = spawn(launcher.command, [...(launcher.args ?? []), ...CLI_ARGS], {
            cwd: request.cwd,
            env: buildAgentEnv(options.env ?? process.env),
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          child = proc
          let stderr = ''
          let reported: string | undefined
          let buffer = ''
          proc.stderr.on('data', (chunk) => (stderr = (stderr + chunk).slice(-500)))
          proc.stdout.on('data', (chunk) => {
            buffer += chunk
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              const { message, error } = textOf(line)
              if (message) emit({ type: 'progress', message })
              if (error) reported = error
            }
          })
          proc.on('error', (error: NodeJS.ErrnoException) => {
            emit({ type: 'failed', reason: error.code === 'ENOENT' ? 'claude CLI not found' : error.message })
            resolve()
          })
          proc.on('close', (code) => {
            if (cancelled) emit({ type: 'failed', reason: 'cancelled' })
            else if (code === 0 && !reported) emit({ type: 'finished' })
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
          child?.kill('SIGTERM')
        },
      }
    },
  }
}
