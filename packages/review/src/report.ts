/**
 * Report protocol: the agent prints, in its own text, `[[bs:<id>:start]]` when it begins a comment, then
 * `[[bs:<id>:done]] <reply>` or `[[bs:<id>:skipped]] <reason>`. Ids are `c` + the stack id.
 * Markers are read from the agent's text only; fields put in the prompt are neutralised first.
 */

export type ReportMark = { id: string; kind: 'start' } | { id: string; kind: 'done' | 'skipped'; reply?: string }

export const MAX_REPLY_LENGTH = 300

/** Kept short: it is sent with every run. */
export const REPORT_INSTRUCTION =
  'Report on each comment by its id, in your own text, each marker on its own line: `[[bs:<id>:start]]` when you begin it, then `[[bs:<id>:done]] <what you changed, one line>` or `[[bs:<id>:skipped]] <why not, one line>`.'

const MARKER = /\[\[bs:(c\d+):(start|done|skipped)\]\]/g
/** A string that a following chunk could complete into a marker. */
const MARKER_PREFIX = /^\[(?:\[(?:b(?:s(?::(?:c\d*(?::[a-z]*\]?)?)?)?)?)?)?$/
const LONGEST_PREFIX = 40

export const promptId = (stackId: string) => `c${stackId}`

/** Breaks anything that reads as a marker, so text from a note, an excerpt or a selector cannot report. */
export const neutralise = (field: string) => field.replace(/\[\[(\s*)bs:/gi, '[[ $1bs:')

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

function clip(s: string): string | undefined {
  const flat = oneLine(s)
  if (!flat) return undefined
  return flat.length > MAX_REPLY_LENGTH ? `${flat.slice(0, MAX_REPLY_LENGTH - 1)}…` : flat
}

/** The agent's text without its markers, as a fallback reply. */
export const stripMarkers = (text: string) => clip(text.replace(MARKER, ' '))

/**
 * Reads markers from agent text that may arrive in pieces, split anywhere. Only ids in `ids` count.
 * An outcome's reply runs to the end of its line or to the next marker, so it is held until one arrives
 * or `flush()` is called at the end of the run.
 */
export function createReportReader(ids: Iterable<string>) {
  const known = new Set(ids)
  let buffer = ''

  function read(final: boolean): ReportMark[] {
    const marks: ReportMark[] = []
    let consumed = 0
    const matches = [...buffer.matchAll(MARKER)]
    for (const [i, m] of matches.entries()) {
      const [whole, id, kind] = m
      const end = m.index + whole.length
      if (kind === 'start') {
        if (known.has(id)) marks.push({ id, kind })
        consumed = end
        continue
      }
      const nextMarker = matches[i + 1]?.index ?? -1
      const newline = buffer.indexOf('\n', end)
      const stop = [nextMarker, newline].filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? (final ? buffer.length : -1)
      if (stop < 0) {
        consumed = m.index // the reply is not complete yet
        buffer = buffer.slice(consumed)
        return marks
      }
      if (known.has(id)) marks.push({ id, kind: kind as 'done' | 'skipped', reply: clip(buffer.slice(end, stop)) })
      consumed = stop
    }
    const rest = buffer.slice(consumed)
    const from = Math.max(0, rest.length - LONGEST_PREFIX)
    let keep = ''
    for (let i = from; i < rest.length; i++) {
      if (MARKER_PREFIX.test(rest.slice(i))) {
        keep = rest.slice(i)
        break
      }
    }
    buffer = final ? '' : keep
    return marks
  }

  return {
    /** Adds agent text and returns the markers it completed. */
    feed: (text: string) => ((buffer += text), read(false)),
    /** Ends the text: a pending outcome takes the rest as its reply. */
    flush: () => read(true),
  }
}
