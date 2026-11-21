import { excerpt, isWholeSlide, type SlideTarget } from '@better-slide/shared'

/** What a click yields before the author writes a note: an element, or the whole slide. */
export type ElementPick = { slide: number } & ({ text: string; selector: string } | SlideTarget)

export const UI_ATTRIBUTE = 'data-better-slide-ui'
const SLIDE_ATTRIBUTE = 'data-slidev-no'
const HIGHLIGHT_ATTRIBUTE = 'data-better-slide-highlight'
const SELECTED_ATTRIBUTE = 'data-better-slide-selected'

/** Smallest meaningful target: a code block is one element, not one token span. */
export function resolveTarget(el: Element): Element {
  return el.closest('pre') ?? el
}

export function slideOf(el: Element): { root: Element; number: number } | undefined {
  const root = el.closest(`[${SLIDE_ATTRIBUTE}]`)
  const number = Number(root?.getAttribute(SLIDE_ATTRIBUTE))
  return root && Number.isInteger(number) && number >= 1 ? { root, number } : undefined
}

/** Path of `tag:nth-of-type(n)` steps from the slide container down to the element. */
export function buildSelector(el: Element, root: Element): string {
  const steps: string[] = []
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const parent: Element | null = node.parentElement
    const tag = node.tagName.toLowerCase()
    const sameTag = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : []
    steps.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag)
  }
  return steps.join(' > ')
}

function describe(el: Element): string {
  const text = excerpt(el.textContent ?? '')
  return text || el.getAttribute('alt') || el.getAttribute('aria-label') || `<${el.tagName.toLowerCase()}>`
}

/** The slide root or its layout wrapper (`.slidev-layout`, which fills the slide): a click there is on the slide's background. */
export function isSlideBackground(el: Element, root: Element): boolean {
  return el === root || (el.parentElement === root && el.classList.contains('slidev-layout'))
}

/** The pick for a click target, and the element to outline: the element, or the slide root for its background. */
export function pickWithElement(raw: Element): { pick: ElementPick; element: Element } | undefined {
  if (raw.closest(`[${UI_ATTRIBUTE}]`)) return undefined
  const el = resolveTarget(raw)
  const slide = slideOf(el)
  if (!slide) return undefined
  if (isSlideBackground(el, slide.root)) return { pick: { slide: slide.number, target: 'slide' }, element: slide.root }
  return { pick: { slide: slide.number, text: describe(el), selector: buildSelector(el, slide.root) }, element: el }
}

export const pickFromElement = (raw: Element): ElementPick | undefined => pickWithElement(raw)?.pick

/** The slide on screen (Slidev keeps recent slides mounted but hidden), as a whole-slide pick. */
export function pickCurrentSlide(doc: Document = document): { pick: ElementPick; element: Element } | undefined {
  const inShow = [...doc.querySelectorAll(`#slide-content [${SLIDE_ATTRIBUTE}]`)]
  const roots = inShow.length ? inShow : [...doc.querySelectorAll(`[${SLIDE_ATTRIBUTE}]`)]
  const root = roots.find((r) => !('checkVisibility' in r) || (r as HTMLElement).checkVisibility()) ?? roots[0]
  const slide = root && slideOf(root)
  return slide ? { pick: { slide: slide.number, target: 'slide' }, element: slide.root } : undefined
}

/** Outlines the selected element or slide until the next selection, or removes the outline. */
export function markSelected(element: Element | undefined, wholeSlide = false, doc: Document = document) {
  doc.querySelectorAll(`[${SELECTED_ATTRIBUTE}]`).forEach((n) => n.removeAttribute(SELECTED_ATTRIBUTE))
  element?.setAttribute(SELECTED_ATTRIBUTE, wholeSlide ? 'slide' : '')
}

/**
 * Selection mode: highlights the hovered element and reports a click as a pick.
 * Returns a stop function that removes the highlight and every listener.
 */
export function startSelection(onPick: (pick: ElementPick, element: Element) => void, doc: Document = document): () => void {
  let highlighted: Element | undefined
  const clear = () => {
    highlighted?.removeAttribute(HIGHLIGHT_ATTRIBUTE)
    highlighted = undefined
  }
  const onOver = (event: Event) => {
    clear()
    const found = event.target instanceof Element ? pickWithElement(event.target) : undefined
    if (!found) return
    highlighted = found.element
    highlighted.setAttribute(HIGHLIGHT_ATTRIBUTE, isWholeSlide(found.pick) ? 'slide' : '')
  }
  // Capture phase: Slidev never sees the click, so a click on the slide's background does not change slide.
  const onClick = (event: Event) => {
    const found = event.target instanceof Element ? pickWithElement(event.target) : undefined
    if (!found) return
    event.preventDefault()
    event.stopPropagation()
    onPick(found.pick, found.element)
  }
  const style = doc.createElement('style')
  style.setAttribute(UI_ATTRIBUTE, '')
  // A slide outline sits inside the slide, which clips anything outside it.
  style.textContent = [
    `[${HIGHLIGHT_ATTRIBUTE}]{outline:2px solid #2563eb !important;outline-offset:2px;cursor:pointer}`,
    `[${HIGHLIGHT_ATTRIBUTE}=slide]{outline-style:dashed !important;outline-offset:-4px}`,
    `[${SELECTED_ATTRIBUTE}]{outline:3px solid #2563eb !important;outline-offset:2px}`,
    `[${SELECTED_ATTRIBUTE}=slide]{outline-offset:-5px}`,
  ].join('')
  doc.head.append(style)
  doc.addEventListener('mouseover', onOver, true)
  doc.addEventListener('click', onClick, true)
  return () => {
    clear()
    markSelected(undefined, false, doc)
    style.remove()
    doc.removeEventListener('mouseover', onOver, true)
    doc.removeEventListener('click', onClick, true)
  }
}
