import type { Comment } from '@better-slide/shared'
import { neutralise, promptId, REPORT_INSTRUCTION } from './report.ts'

type Item = Comment & { id: string }

/** One line, no marker: a field cannot pose as a `Slide N` section, a list item or a report. */
const field = (s: string) => neutralise(s.replace(/\s+/g, ' ').trim())

/** The order comments appear in the prompt: by slide, stack order inside a slide. */
export const promptOrder = <T extends Item>(items: T[]): T[] => [...items].sort((a, b) => a.slide - b.slide)

/** One compact prompt for the whole stack, grouped by slide, each comment with its report id. */
export function buildPrompt(comments: Item[]): string {
  const bySlide = new Map<number, Item[]>()
  for (const c of promptOrder(comments)) bySlide.set(c.slide, [...(bySlide.get(c.slide) ?? []), c])
  const sections = [...bySlide].map(([slide, list]) => {
    const lines = list.map((c) => {
      const where = [`text "${field(c.text)}"`, `selector \`${field(c.selector)}\``, c.line ? `near line ${c.line}` : ''].filter(Boolean)
      return `- ${promptId(c.id)}: ${where.join(', ')}\n  Change: ${field(c.note)}`
    })
    return `Slide ${slide}\n${lines.join('\n')}`
  })
  return [
    'Edit this Slidev deck (slides.md and files it imports) to apply the review comments below.',
    'Slides are numbered from 1 in order of appearance. Each comment names the element by its text; a line number is only a hint.',
    'Change only what the comments ask. Keep the deck a valid Slidev project.',
    REPORT_INSTRUCTION,
    '',
    sections.join('\n\n'),
  ].join('\n')
}
