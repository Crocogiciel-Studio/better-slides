<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import ReviewSidebar from './components/ReviewSidebar.vue'
import { isPlayMode, useReview } from './components/reviewState'
import { startSelection } from './components/selection'

// Slidev renders this layer inside the scaled slide, so the sidebar is teleported to <body>.
const play = isPlayMode(location.pathname, import.meta.env.BASE_URL)
const review = useReview()
const ROOT_CLASS = 'better-slide-review'

let stopSelection: (() => void) | undefined
let stopRun: (() => void) | undefined

watch(review.open, (on) => {
  document.documentElement.classList.toggle(ROOT_CLASS, on)
  stopSelection?.()
  stopSelection = on ? startSelection((pick) => review.select(pick)) : undefined
})

/** `r` toggles review mode, unless the author is typing or using a modifier. */
function onKey(e: KeyboardEvent) {
  const target = e.target instanceof HTMLElement ? e.target : undefined
  const typing = target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
  if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) review.toggle()
}

onMounted(() => {
  if (!play) return
  stopRun = review.start()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  stopSelection?.()
  stopRun?.()
  window.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove(ROOT_CLASS)
})
</script>

<template>
  <Teleport v-if="play && review.open.value" to="body">
    <ReviewSidebar />
  </Teleport>
</template>

<style>
/* Same idea as Slidev's side editor: the page gets narrower, so the canvas rescales and is never covered. */
html.better-slide-review {
  --better-slide-sidebar-width: clamp(300px, 28vw, 380px);
}
html.better-slide-review #page-root {
  width: calc(100% - var(--better-slide-sidebar-width));
}
</style>
