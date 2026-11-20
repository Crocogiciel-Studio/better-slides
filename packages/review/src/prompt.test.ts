import { describe, expect, it } from 'vitest'
import { buildPrompt } from './prompt.ts'
import { excerpt } from '@better-slide/shared'
import { locateLine } from './locate.ts'

describe('buildPrompt', () => {
  const comments = [
    { slide: 4, text: 'Install', selector: 'h1', note: 'Rename to Setup' },
    { slide: 2, text: 'Intro text', selector: 'p', line: 14, note: 'Shorten it' },
    { slide: 2, text: 'Item', selector: 'li', note: 'Remove' },
  ]

  it('lists every comment once, grouped by slide in order', () => {
    const p = buildPrompt(comments)
    for (const c of comments) expect(p.split(c.note).length - 1).toBe(1)
    expect(p.indexOf('Slide 2')).toBeLessThan(p.indexOf('Slide 4'))
    expect(p.match(/^Slide 2/gm)).toHaveLength(1)
    expect(p).toContain('near line 14')
  })
})

describe('locateLine', () => {
  const file = '---\ntitle: x\n---\n\n# One\n\nhello\n\n---\n\n# Two\n\nSecond paragraph here\n\n```bash\npnpm install\n```\n'
  const slide2 = '# Two\n\nSecond paragraph here\n\n```bash\npnpm install\n```'

  it('finds a paragraph, a heading and a code line', () => {
    expect(locateLine(file, slide2, 'Second paragraph here')).toBe(13)
    expect(locateLine(file, slide2, 'Two')).toBe(11)
    expect(locateLine(file, slide2, 'pnpm install')).toBe(16)
  })

  it('gives up when the text is not in the slide', () => {
    expect(locateLine(file, slide2, 'nothing like it')).toBeUndefined()
    expect(locateLine(file, 'absent slide', 'x')).toBeUndefined()
  })

  it('matches a paragraph longer than the excerpt limit despite the ellipsis', () => {
    const long = 'word '.repeat(60).trim()
    const f = `---\n---\n\n# T\n\n${long}\n`
    expect(locateLine(f, `# T\n\n${long}`, excerpt(long))).toBe(6)
  })

  it('matches rendered text against inline markdown', () => {
    const body = '# T\n\nUse **bold** and `code` with [a link](https://x.y) here'
    const f = `---\n---\n\n${body}\n`
    expect(locateLine(f, body, 'Use bold and code with a link here')).toBe(6)
  })
})
