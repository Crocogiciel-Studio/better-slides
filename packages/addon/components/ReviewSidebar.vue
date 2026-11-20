<script setup lang="ts">
import ReviewComposer from './ReviewComposer.vue'
import RunStatus from './RunStatus.vue'
import { useReview } from './reviewState'

const review = useReview()
</script>

<template>
  <aside
    class="better-slide-sidebar flex flex-col bg-main text-main border-l border-main"
    aria-label="Review"
    data-better-slide-ui
    data-testid="sidebar"
  >
    <header class="flex items-center justify-between px-3 py-2 border-b border-main">
      <strong class="text-base">Review</strong>
      <button class="slidev-icon-btn" title="Leave review mode (r)" data-testid="close" @click="review.toggle">
        <div class="i-carbon:close" />
      </button>
    </header>

    <ReviewComposer v-if="review.pick.value" :pick="review.pick.value" @add="review.add" @cancel="review.dismiss" />

    <div class="flex-1 min-h-0 overflow-y-auto p-3" data-testid="stack">
      <p v-if="!review.count.value && !review.pick.value" class="text-sm opacity-70">Click an element on the slide to comment on it.</p>
      <section v-for="g in review.groups.value" :key="g.slide" class="mb-4" data-testid="group">
        <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Slide {{ g.slide }}</h3>
        <ul class="list-none m-0 p-0 flex flex-col gap-2">
          <li v-for="c in g.items" :key="c.id" class="p-2 rounded border border-main bg-active text-sm" data-testid="item">
            <div class="text-xs opacity-60 break-words">{{ c.text }}</div>
            <div class="mt-1 whitespace-pre-wrap break-words">{{ c.note }}</div>
            <button v-if="!review.locked.value" class="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline" data-testid="remove" @click="review.remove(c.id)">
              Remove
            </button>
          </li>
        </ul>
      </section>
    </div>

    <footer class="p-3 border-t border-main flex flex-col gap-2">
      <div v-if="review.error.value" class="text-sm text-red-600 dark:text-red-400 break-words" data-testid="error">{{ review.error.value }}</div>
      <div class="flex items-start justify-between gap-2">
        <RunStatus :status="review.status.value" />
        <button
          v-if="review.status.value.state === 'running'"
          class="px-2 py-0.5 rounded text-sm border border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
          data-testid="cancel"
          @click="review.cancel"
        >
          Cancel
        </button>
      </div>
      <button class="w-full px-3 py-1.5 rounded text-sm bg-primary text-white disabled:opacity-40" :disabled="!review.canSend.value" data-testid="send" @click="review.send">
        Send stack ({{ review.count.value }})
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.better-slide-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--better-slide-sidebar-width);
  z-index: 60;
}
</style>
