export const MAX_EXCERPT_LENGTH = 120
export const MAX_NOTE_LENGTH = 2000
export const MAX_SELECTOR_LENGTH = 500

/** A comment on one element of a slide. `target` is absent on comments made before whole-slide comments. */
export interface ElementTarget {
  target?: 'element'
  /** Short excerpt of the element's text. */
  text: string
  /** CSS selector of the element, relative to its slide. */
  selector: string
  /** Line in the deck source, when known. */
  line?: number
}

/** A comment on the slide as a whole. */
export interface SlideTarget {
  target: 'slide'
}

/** A review comment on a slide element or on the whole slide. */
export type Comment = {
  /** 1-based slide number. */
  slide: number
  /** What the author wants changed. */
  note: string
} & (ElementTarget | SlideTarget)

export const isWholeSlide = (c: object): c is SlideTarget => (c as { target?: unknown }).target === 'slide'

type Field = 'slide' | 'target' | 'text' | 'selector' | 'line' | 'note'

export type ValidationResult = { ok: true; comment: Comment } | { ok: false; field: Field; message: string }

export function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_EXCERPT_LENGTH ? `${flat.slice(0, MAX_EXCERPT_LENGTH - 1)}…` : flat
}

function missing(field: Field): ValidationResult {
  return { ok: false, field, message: `Missing or invalid field: ${field}` }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function validateComment(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null) return missing('slide')
  const c = input as Record<string, unknown>
  if (!Number.isInteger(c.slide) || (c.slide as number) < 1) return missing('slide')
  if (c.target !== undefined && c.target !== 'element' && c.target !== 'slide') return missing('target')
  if (c.target === 'slide') {
    // Text, selector and line mean nothing for a whole slide: they are dropped.
    if (!nonEmptyString(c.note) || c.note.length > MAX_NOTE_LENGTH) return missing('note')
    return { ok: true, comment: { slide: c.slide as number, target: 'slide', note: c.note.trim() } }
  }
  if (!nonEmptyString(c.text)) return missing('text')
  if (!nonEmptyString(c.selector) || c.selector.length > MAX_SELECTOR_LENGTH) return missing('selector')
  if (!nonEmptyString(c.note) || c.note.length > MAX_NOTE_LENGTH) return missing('note')
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
