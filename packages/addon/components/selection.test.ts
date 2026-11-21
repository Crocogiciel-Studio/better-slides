// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSelector, markSelected, pickCurrentSlide, pickFromElement, startSelection } from './selection.ts'

function deck() {
  document.body.innerHTML = `
    <div data-slidev-no="1"><h1>Title</h1></div>
    <div data-slidev-no="2" id="s2"><div class="slidev-layout default" id="layout2">
      <h1>Why</h1>
      <p id="p1">First paragraph</p>
      <p id="p2">Second   paragraph</p>
      <pre><code><span id="tok">pnpm</span> install</code></pre>
      <ul><li class="slidev-vclick-hidden" id="li">Animated item</li></ul>
      <img id="img" alt="Logo">
    </div></div>
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
    expect(pick).toEqual({ slide: 2, text: 'Second paragraph', selector: 'div > p:nth-of-type(2)' })
    expect(document.getElementById('s2')!.querySelector((pick as { selector: string }).selector)).toBe(document.getElementById('p2'))
  })

  it('selects the whole code block from a token inside it', () => {
    deck()
    const pick = pickFromElement(document.getElementById('tok')!)
    expect(pick).toMatchObject({ slide: 2, text: 'pnpm install', selector: 'div > pre' })
  })

  it('handles a click-animated element', () => {
    deck()
    expect(pickFromElement(document.getElementById('li')!)).toMatchObject({ slide: 2, text: 'Animated item' })
  })

  it('describes an element without text by its alt', () => {
    deck()
    expect(pickFromElement(document.getElementById('img')!)).toMatchObject({ text: 'Logo' })
  })

  it('ignores the review UI and elements outside a slide', () => {
    deck()
    expect(pickFromElement(document.getElementById('ui')!)).toBeUndefined()
    expect(pickFromElement(document.body)).toBeUndefined()
  })
})

describe('whole slide', () => {
  it('picks the whole slide from its background: the slide root or its layout wrapper', () => {
    deck()
    expect(pickFromElement(document.getElementById('layout2')!)).toEqual({ slide: 2, target: 'slide' })
    expect(pickFromElement(document.getElementById('s2')!)).toEqual({ slide: 2, target: 'slide' })
    expect(pickFromElement(document.querySelector('[data-slidev-no="1"]')!)).toEqual({ slide: 1, target: 'slide' })
  })

  it('outlines the slide on hover and when selected, and reports the slide root', () => {
    deck()
    const onPick = vi.fn()
    const stop = startSelection(onPick)
    const layout = document.getElementById('layout2')!
    const root = document.getElementById('s2')!
    layout.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(root.getAttribute('data-better-slide-highlight')).toBe('slide')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    layout.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(onPick).toHaveBeenCalledWith({ slide: 2, target: 'slide' }, root)
    markSelected(root, true)
    expect(root.getAttribute('data-better-slide-selected')).toBe('slide')
    markSelected(document.getElementById('p1')!)
    expect(root.hasAttribute('data-better-slide-selected')).toBe(false)
    stop()
    expect(document.querySelector('[data-better-slide-selected]')).toBeNull()
  })

  it('picks the slide on screen for the Whole slide control', () => {
    document.body.innerHTML = '<div id="slide-content"><div data-slidev-no="3" style="display:none"></div><div data-slidev-no="4"></div></div>'
    expect(pickCurrentSlide()?.pick).toEqual({ slide: 4, target: 'slide' })
  })
})

describe('buildSelector', () => {
  it('stops at the slide root', () => {
    deck()
    const root = document.getElementById('s2')!
    expect(buildSelector(document.querySelector('li')!, root)).toBe('div > ul > li')
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
    expect(onPick).toHaveBeenCalledWith({ slide: 2, text: 'First paragraph', selector: 'div > p:nth-of-type(1)' }, p)

    stop()
    expect(document.querySelector('[data-better-slide-highlight]')).toBeNull()
    expect(document.head.querySelector('style')).toBeNull()
    p.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onPick).toHaveBeenCalledTimes(1)
  })
})
