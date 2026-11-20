import type { Comment } from '@better-slide/shared'

/** One line: a field cannot start a new line, so it cannot pose as a `Slide N` section or a list item. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** One compact prompt for the whole stack, grouped by slide. */
export function buildPrompt(comments: Comment[]): string {
  const bySlide = new Map<number, Comment[]>()
  for (const c of [...comments].sort((a, b) => a.slide - b.slide)) {
    bySlide.set(c.slide, [...(bySlide.get(c.slide) ?? []), c])
  }
  const sections = [...bySlide].map(([slide, list]) => {
    const lines = list.map((c) => {
      const where = [`text "${oneLine(c.text)}"`, `selector \`${oneLine(c.selector)}\``, c.line ? `near line ${c.line}` : ''].filter(Boolean)
      return `- ${where.join(', ')}\n  Change: ${oneLine(c.note)}`
    })
    return `Slide ${slide}\n${lines.join('\n')}`
  })
  return [
    'Edit this Slidev deck (slides.md and files it imports) to apply the review comments below.',
    'Slides are numbered from 1 in order of appearance. Each comment names the element by its text; a line number is only a hint.',
    'Change only what the comments ask. Keep the deck a valid Slidev project.',
    '',
    sections.join('\n\n'),
  ].join('\n')
}
