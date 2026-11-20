const normalize = (s: string) => s.replace(/^\s*(#+|[-*+]|\d+\.|>)\s+/, '').replace(/\s+/g, ' ').trim()

/**
 * Best-effort 1-based line of `text` in the deck file, searched inside the slide's own source.
 * Slidev emits no per-element source position, so this is a hint, not a guarantee.
 */
export function locateLine(fileText: string, slideContent: string, text: string): number | undefined {
  const body = slideContent.trim()
  const base = body ? fileText.indexOf(body) : -1
  if (base < 0) return undefined
  const target = normalize(text)
  const lines = body.split('\n')
  const hit = lines.findIndex((raw) => {
    const line = normalize(raw)
    return line.length >= 3 && (target.startsWith(line) || line.includes(target))
  })
  if (hit < 0) return undefined
  return fileText.slice(0, base).split('\n').length + hit
}
