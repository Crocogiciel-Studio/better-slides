<script setup lang="ts">
import type { CommentState } from '@better-slide/shared'
import ReviewComposer from './ReviewComposer.vue'
import RunStatus from './RunStatus.vue'
import { STATE_LABELS, useReview } from './reviewState'

const review = useReview()

const STATE_STYLE: Record<CommentState, { icon: string; color: string }> = {
  waiting: { icon: 'i-carbon:time', color: 'opacity-60' },
  'in-progress': { icon: 'i-carbon:renew animate-spin', color: 'text-blue-700 dark:text-blue-300' },
  done: { icon: 'i-carbon:checkmark-outline', color: 'text-green-700 dark:text-green-400' },
  'not-done': { icon: 'i-carbon:warning-alt', color: 'text-amber-700 dark:text-amber-300' },
  failed: { icon: 'i-carbon:error', color: 'text-red-600 dark:text-red-400' },
  unreported: { icon: 'i-carbon:help', color: 'opacity-70' },
}
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
      <p v-if="!review.comments.value.length && !review.pick.value" class="text-sm opacity-70">Click an element on the slide to comment on it.</p>
      <section v-for="g in review.groups.value" :key="g.slide" class="mb-4" data-testid="group">
        <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Slide {{ g.slide }}</h3>
        <ul class="list-none m-0 p-0 flex flex-col gap-2">
          <li v-for="c in g.items" :key="c.id" class="p-2 rounded border border-main bg-active text-sm" :data-state="c.state" data-testid="item">
            <div class="flex items-start justify-between gap-2">
              <div class="text-xs opacity-60 break-words min-w-0">{{ c.text }}</div>
              <span class="shrink-0 inline-flex items-center gap-1 text-xs font-medium" :class="STATE_STYLE[c.state].color" data-testid="state">
                <span :class="STATE_STYLE[c.state].icon" aria-hidden="true" />{{ STATE_LABELS[c.state] }}
              </span>
            </div>
            <div class="mt-1 whitespace-pre-wrap break-words">{{ c.note }}</div>
            <div v-if="c.reply" class="mt-1.5 pl-2 border-l-2 border-current text-xs break-words" :class="STATE_STYLE[c.state].color" data-testid="reply">
              <span v-if="c.state === 'unreported'">Agent's summary: </span>{{ c.reply }}
            </div>
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
        <RunStatus :status="review.status.value" :outcome="review.outcome.value" />
        <button
          v-if="review.status.value.state === 'running'"
          class="px-2 py-0.5 rounded text-sm border border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
          data-testid="cancel"
          @click="review.cancel"
        >
          Cancel
        </button>
      </div>
      <div class="flex gap-2">
        <button
          v-if="review.finished.value && !review.running.value"
          class="shrink-0 px-2 py-1.5 rounded text-sm border border-main hover:bg-active"
          title="Remove the comments the agent finished; the others stay for the next send"
          data-testid="clear-finished"
          @click="review.clearFinished"
        >
          Clear finished ({{ review.finished.value }})
        </button>
        <button class="flex-1 min-w-0 px-3 py-1.5 rounded text-sm bg-primary text-white disabled:opacity-40" :disabled="!review.canSend.value" data-testid="send" @click="review.send">
          {{ review.running.value ? 'Agent working…' : `Send stack (${review.sendable.value})` }}
        </button>
      </div>
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
