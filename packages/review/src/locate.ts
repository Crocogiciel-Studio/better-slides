import { MAX_EXCERPT_LENGTH } from '@better-slide/shared'

/** Text as Slidev renders it: block and inline markdown markers removed, spaces collapsed. */
const normalize = (s: string) =>
  s
    .replace(/^\s*(#+|[-*+]|\d+\.|>)\s+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`|\*|\b_|_\b)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** An excerpt cut at the length limit ends with an ellipsis the source does not have. */
const withoutCut = (text: string) =>
  text.length === MAX_EXCERPT_LENGTH && text.endsWith('…') ? text.slice(0, -1).trimEnd() : text

/**
 * Best-effort 1-based line of `text` in the deck file, searched inside the slide's own source.
 * Slidev emits no per-element source position, so this is a hint, not a guarantee: it matches
 * the first source line that starts or contains the rendered text, after dropping inline markup.
 */
export function locateLine(fileText: string, slideContent: string, text: string): number | undefined {
  const body = slideContent.trim()
  const base = body ? fileText.indexOf(body) : -1
  if (base < 0) return undefined
  const target = normalize(withoutCut(text))
  const lines = body.split('\n')
  const hit = lines.findIndex((raw) => {
    const line = normalize(raw)
    return line.length >= 3 && (target.startsWith(line) || line.includes(target))
  })
  if (hit < 0) return undefined
  return fileText.slice(0, base).split('\n').length + hit
}
