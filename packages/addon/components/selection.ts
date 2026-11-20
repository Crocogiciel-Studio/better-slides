import { excerpt, type Comment } from '@better-slide/shared'

/** What a click yields before the author writes a note. */
export type Pick = Pick_<Comment, 'slide' | 'text' | 'selector'>
type Pick_<T, K extends keyof T> = { [P in K]: T[P] }

export const UI_ATTRIBUTE = 'data-better-slide-ui'
const SLIDE_ATTRIBUTE = 'data-slidev-no'
const HIGHLIGHT_ATTRIBUTE = 'data-better-slide-highlight'

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

export function pickFromElement(raw: Element): Pick | undefined {
  if (raw.closest(`[${UI_ATTRIBUTE}]`)) return undefined
  const el = resolveTarget(raw)
  const slide = slideOf(el)
  if (!slide) return undefined
  return { slide: slide.number, text: describe(el), selector: buildSelector(el, slide.root) }
}

/**
 * Selection mode: highlights the hovered element and reports a click as a pick.
 * Returns a stop function that removes the highlight and every listener.
 */
export function startSelection(onPick: (pick: Pick) => void, doc: Document = document): () => void {
  let highlighted: Element | undefined
  const clear = () => {
    highlighted?.removeAttribute(HIGHLIGHT_ATTRIBUTE)
    highlighted = undefined
  }
  const onOver = (event: Event) => {
    clear()
    const target = event.target instanceof Element ? event.target : undefined
    if (!target || !pickFromElement(target)) return
    highlighted = resolveTarget(target)
    highlighted.setAttribute(HIGHLIGHT_ATTRIBUTE, '')
  }
  const onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : undefined
    const pick = target && pickFromElement(target)
    if (!pick) return
    event.preventDefault()
    event.stopPropagation()
    onPick(pick)
  }
  const style = doc.createElement('style')
  style.setAttribute(UI_ATTRIBUTE, '')
  style.textContent = `[${HIGHLIGHT_ATTRIBUTE}]{outline:2px solid #2563eb !important;outline-offset:2px;cursor:pointer}`
  doc.head.append(style)
  doc.addEventListener('mouseover', onOver, true)
  doc.addEventListener('click', onClick, true)
  return () => {
    clear()
    style.remove()
    doc.removeEventListener('mouseover', onOver, true)
    doc.removeEventListener('click', onClick, true)
  }
}
