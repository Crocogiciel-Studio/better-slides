<script setup lang="ts">
import { computed } from 'vue'
import type { RunStatus } from '@better-slide/shared'
import { describeActivity } from './reviewState'

const props = defineProps<{ status: RunStatus; outcome?: string }>()
const text = computed(() => {
  const s = props.status
  if (s.state === 'failed') return s.kind === 'cancelled' ? 'Agent: cancelled' : `Agent: failed: ${s.reason}`
  if (s.state === 'running') return describeActivity(s.activity)
  return props.outcome && s.state === 'finished' ? `Agent: finished · ${props.outcome}` : `Agent: ${s.state}`
})
const color = computed(
  () =>
    ({ running: 'text-blue-700 dark:text-blue-300', finished: 'text-green-700 dark:text-green-400', failed: 'text-red-600 dark:text-red-400' })[props.status.state as string] ??
    'opacity-70',
)
</script>

<template>
  <div class="min-w-0 flex flex-col gap-0.5">
    <div class="text-sm break-words flex items-center gap-1.5 min-w-0" :class="color" :data-state="status.state" data-testid="status">
      <span v-if="status.state === 'running'" class="i-carbon:renew animate-spin shrink-0" aria-hidden="true" />
      <span class="min-w-0 break-words">{{ text }}</span>
    </div>
    <div v-if="status.state === 'running' && status.current" class="text-xs opacity-70" data-testid="progress">
      Comment {{ status.current.index }} of {{ status.current.total }}
    </div>
  </div>
</template>
