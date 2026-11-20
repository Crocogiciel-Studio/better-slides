// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSelector, pickFromElement, startSelection } from './selection.ts'

function deck() {
  document.body.innerHTML = `
    <div data-slidev-no="1"><h1>Title</h1></div>
    <div data-slidev-no="2" id="s2">
      <h1>Why</h1>
      <p id="p1">First paragraph</p>
      <p id="p2">Second   paragraph</p>
      <pre><code><span id="tok">pnpm</span> install</code></pre>
      <ul><li class="slidev-vclick-hidden" id="li">Animated item</li></ul>
      <img id="img" alt="Logo">
    </div>
    <div data-better-slide-ui><button id="ui">Send</button></div>`
}

afterEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})

describe('pickFromElement', () => {
  it('produces slide, text and selector for a paragraph', () => {
    deck()
    const pick = pickFromElement(document.getElementById('p2')!)
    expect(pick).toEqual({ slide: 2, text: 'Second paragraph', selector: 'p:nth-of-type(2)' })
    expect(document.getElementById('s2')!.querySelector(pick!.selector)).toBe(document.getElementById('p2'))
  })

  it('selects the whole code block from a token inside it', () => {
    deck()
    const pick = pickFromElement(document.getElementById('tok')!)
    expect(pick).toMatchObject({ slide: 2, text: 'pnpm install', selector: 'pre' })
  })

  it('handles a click-animated element', () => {
    deck()
    expect(pickFromElement(document.getElementById('li')!)).toMatchObject({ slide: 2, text: 'Animated item' })
  })

  it('describes an element without text by its alt', () => {
    deck()
    expect(pickFromElement(document.getElementById('img')!)?.text).toBe('Logo')
  })

  it('ignores the review UI and elements outside a slide', () => {
    deck()
    expect(pickFromElement(document.getElementById('ui')!)).toBeUndefined()
    expect(pickFromElement(document.body)).toBeUndefined()
  })
})

describe('buildSelector', () => {
  it('stops at the slide root', () => {
    deck()
    const root = document.getElementById('s2')!
    expect(buildSelector(document.querySelector('li')!, root)).toBe('ul > li')
  })
})

describe('startSelection', () => {
  it('highlights on hover, reports a click and cleans up on stop', () => {
    deck()
    const onPick = vi.fn()
    const stop = startSelection(onPick)
    const p = document.getElementById('p1')!
    p.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(p.hasAttribute('data-better-slide-highlight')).toBe(true)
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onPick).toHaveBeenCalledWith({ slide: 2, text: 'First paragraph', selector: 'p:nth-of-type(1)' })

    stop()
    expect(document.querySelector('[data-better-slide-highlight]')).toBeNull()
    expect(document.head.querySelector('style')).toBeNull()
    p.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onPick).toHaveBeenCalledTimes(1)
  })
})
