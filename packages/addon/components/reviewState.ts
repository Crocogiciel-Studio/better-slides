import { computed, ref } from 'vue'
import type { RunStatus, StackItem } from '@better-slide/shared'
import { createClient } from './api'
import type { ElementPick } from './selection'

type Client = ReturnType<typeof createClient>

/** Pages where the review UI lives: the play view only, not presenter, overview, print or export. */
export function isPlayMode(pathname: string, base = '/'): boolean {
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '')
  return !/^(presenter|overview|notes|export|entry|print|handout)(\/|$)/.test(path)
}

export interface SlideGroup {
  slide: number
  items: StackItem[]
}

/** Comments grouped by slide, slides ascending, original order kept inside a slide. */
export function groupBySlide(comments: StackItem[]): SlideGroup[] {
  const groups = new Map<number, StackItem[]>()
  for (const c of comments) groups.set(c.slide, [...(groups.get(c.slide) ?? []), c])
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([slide, items]) => ({ slide, items }))
}

/** Gives the keyboard back to the deck: Slidev reads keys on the window, not on a focused button. */
export function releaseFocus(doc: Document | undefined = typeof document === 'undefined' ? undefined : document) {
  const active = doc?.activeElement
  if (active instanceof HTMLElement && active !== doc?.body) active.blur()
}

/** Review state shared by the toggle (in Slidev's bar) and the sidebar. */
export function createReviewState(api: Client, release: () => void = releaseFocus) {
  const open = ref(false)
  const comments = ref<StackItem[]>([])
  const locked = ref(false)
  const status = ref<RunStatus>({ state: 'idle' })
  const error = ref('')
  const pick = ref<ElementPick>()

  const count = computed(() => comments.value.length)
  const running = computed(() => status.value.state === 'running' || locked.value)
  const canSend = computed(() => count.value > 0 && !running.value)
  const groups = computed(() => groupBySlide(comments.value))

  async function guarded(action: () => Promise<unknown>) {
    error.value = ''
    try {
      await action()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function refresh() {
    await guarded(async () => {
      const data = await api.list()
      comments.value = data.comments
      locked.value = data.locked
    })
  }

  /** Loads the stack and follows the run status. Returns a stop function. */
  function start(): () => void {
    refresh()
    return api.follow((s) => {
      const changed = s.state !== status.value.state
      status.value = s
      if (changed) refresh()
    })
  }

  function toggle() {
    open.value = !open.value
    if (!open.value) pick.value = undefined
    release()
  }

  const select = (p: ElementPick) => {
    pick.value = p
    release()
  }

  const dismiss = () => {
    pick.value = undefined
    release()
  }

  const add = (note: string) =>
    guarded(async () => {
      if (!pick.value) return
      await api.add({ ...pick.value, note })
      pick.value = undefined
      await refresh()
    }).finally(release)

  const remove = (id: string) => guarded(async () => (await api.remove(id), refresh())).finally(release)
  const send = () => guarded(async () => (await api.send(), refresh())).finally(release)
  const cancel = () => guarded(() => api.cancel()).finally(release)

  return { open, comments, locked, status, error, pick, count, running, canSend, groups, start, refresh, toggle, select, dismiss, add, remove, send, cancel }
}

let shared: ReturnType<typeof createReviewState> | undefined

/** One state for the whole page: the toggle and the sidebar are mounted apart by Slidev. */
export function useReview() {
  return (shared ??= createReviewState(createClient()))
}
