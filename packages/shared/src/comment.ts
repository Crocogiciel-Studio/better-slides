export const MAX_EXCERPT_LENGTH = 120

/** A review comment attached to one slide element. */
export interface Comment {
  /** 1-based slide number. */
  slide: number
  /** Short excerpt of the element's text. */
  text: string
  /** CSS selector of the element, relative to its slide. */
  selector: string
  /** Line in the deck source, when known. */
  line?: number
  /** What the author wants changed. */
  note: string
}

export type ValidationResult =
  | { ok: true; comment: Comment }
  | { ok: false; field: keyof Comment; message: string }

export function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_EXCERPT_LENGTH ? `${flat.slice(0, MAX_EXCERPT_LENGTH - 1)}…` : flat
}

function missing(field: keyof Comment): ValidationResult {
  return { ok: false, field, message: `Missing or invalid field: ${field}` }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function validateComment(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null) return missing('slide')
  const c = input as Record<string, unknown>
  if (!Number.isInteger(c.slide) || (c.slide as number) < 1) return missing('slide')
  if (!nonEmptyString(c.text)) return missing('text')
  if (!nonEmptyString(c.selector)) return missing('selector')
  if (!nonEmptyString(c.note)) return missing('note')
  if (c.line !== undefined && (!Number.isInteger(c.line) || (c.line as number) < 1)) return missing('line')
  return {
    ok: true,
    comment: {
      slide: c.slide as number,
      text: excerpt(c.text),
      selector: c.selector.trim(),
      ...(c.line !== undefined ? { line: c.line as number } : {}),
      note: c.note.trim(),
    },
  }
}
