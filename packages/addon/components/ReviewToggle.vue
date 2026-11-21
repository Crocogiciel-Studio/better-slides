<script setup lang="ts">
import { useReview } from './reviewState'

const review = useReview()
</script>

<template>
  <button
    class="slidev-icon-btn"
    :class="{ active: review.open.value }"
    :title="review.open.value ? 'Leave review mode (r)' : 'Review the deck with comments (r)'"
    :aria-pressed="review.open.value"
    data-better-slide-ui
    data-testid="toggle"
    @click="review.toggle"
  >
    <span class="sr-only">Review</span>
    <div class="i-carbon:chat" />
    <span
      v-if="review.count.value"
      class="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-xs leading-4 text-center"
      data-testid="count"
    >
      {{ review.count.value }}
    </span>
  </button>
</template>
