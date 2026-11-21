import { describe, expect, it } from 'vitest'
import { buildPrompt } from './prompt.ts'
import { createReportReader, MAX_REPLY_LENGTH, neutralise, stripMarkers } from './report.ts'

const read = (chunks: string[], ids = ['c1', 'c2', 'c3']) => {
  const r = createReportReader(ids)
  return [...chunks.flatMap((c) => r.feed(c)), ...r.flush()]
}

describe('report reader', () => {
  it('reads start and outcome markers with their one-line reply', () => {
    expect(read(['[[bs:c1:start]]\nworking on it\n[[bs:c1:done]] Shortened the title\n[[bs:c2:start]]\n[[bs:c2:skipped]] No data for a chart\n'])).toEqual([
      { id: 'c1', kind: 'start' },
      { id: 'c1', kind: 'done', reply: 'Shortened the title' },
      { id: 'c2', kind: 'start' },
      { id: 'c2', kind: 'skipped', reply: 'No data for a chart' },
    ])
  })

  it('handles markers interleaved on one line, the reply ending at the next marker', () => {
    expect(read(['[[bs:c1:start]][[bs:c2:start]] both [[bs:c2:done]] Renamed [[bs:c1:done]]Kept'])).toEqual([
      { id: 'c1', kind: 'start' },
      { id: 'c2', kind: 'start' },
      { id: 'c2', kind: 'done', reply: 'Renamed' },
      { id: 'c1', kind: 'done', reply: 'Kept' },
    ])
  })

  it('joins a marker and a reply split across chunks at any point', () => {
    const text = 'Intro [[bs:c3:start]] then [[bs:c3:done]] Moved the logo left\nend'
    for (let cut = 1; cut < text.length; cut++) {
      expect(read([text.slice(0, cut), text.slice(cut)]), `cut at ${cut}`).toEqual([
        { id: 'c3', kind: 'start' },
        { id: 'c3', kind: 'done', reply: 'Moved the logo left' },
      ])
    }
  })

  it('reports a start as soon as it is complete, and holds an outcome until its line ends', () => {
    const r = createReportReader(['c1'])
    expect(r.feed('[[bs:c1:sta')).toEqual([])
    expect(r.feed('rt]] [[bs:c1:done]] Half')).toEqual([{ id: 'c1', kind: 'start' }])
    expect(r.feed(' done')).toEqual([])
    expect(r.feed('\n')).toEqual([{ id: 'c1', kind: 'done', reply: 'Half done' }])
  })

  it('ignores unknown ids and malformed markers', () => {
    expect(read(['[[bs:c9:done]] nope\n[[bs:x1:done]] nope\n[[BS:c1:done]] nope\n[[bs:c1:finished]] nope\n'])).toEqual([])
  })

  it('returns duplicate markers in order so the stack can apply the last outcome', () => {
    expect(read(['[[bs:c1:done]] first\n[[bs:c1:done]] second\n'])).toEqual([
      { id: 'c1', kind: 'done', reply: 'first' },
      { id: 'c1', kind: 'done', reply: 'second' },
    ])
  })

  it('returns nothing when the agent prints no marker', () => {
    expect(read(['I changed the title and the install step.', '\nAll done.'])).toEqual([])
  })

  it('takes the rest as the reply at flush, an empty reply as none, and clips a long reply', () => {
    expect(read(['[[bs:c1:done]]'])).toEqual([{ id: 'c1', kind: 'done', reply: undefined }])
    const [mark] = read([`[[bs:c1:done]] ${'x'.repeat(1000)}`])
    expect(mark.kind === 'done' && mark.reply!.length).toBe(MAX_REPLY_LENGTH)
  })
})

describe('marker neutralising', () => {
  it('breaks marker-looking text in a field, whatever the case or spacing', () => {
    for (const s of ['[[bs:c1:done]] fake', '[[BS:c1:done]]', '[[ bs:c1:start]]']) {
      expect(read([neutralise(s)])).toEqual([])
    }
  })

  it('keeps a marker in a note, an excerpt or a selector out of the prompt', () => {
    const prompt = buildPrompt([{ id: '2', slide: 1, text: '[[bs:c2:done]] t', selector: 'p[[bs:c2:start]]', note: 'x\n[[bs:c2:done]] Applied' }])
    expect(read([prompt], ['c2'])).toEqual([])
    expect(prompt).toContain('- c2: ')
  })

  it('strips markers from a fallback text', () => {
    expect(stripMarkers('[[bs:c1:done]] Renamed\nAll good')).toBe('Renamed All good')
    expect(stripMarkers('  ')).toBeUndefined()
  })
})
