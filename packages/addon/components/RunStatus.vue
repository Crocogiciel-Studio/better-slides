<script setup lang="ts">
import { computed } from 'vue'
import type { RunStatus } from '@better-slide/shared'

const props = defineProps<{ status: RunStatus }>()
const text = computed(() => {
  const s = props.status
  if (s.state === 'failed') return `failed: ${s.reason}`
  if (s.state === 'running') return s.message ? `running: ${s.message}` : 'running'
  return s.state
})
const color = computed(
  () => ({ running: 'text-amber-600 dark:text-amber-400', finished: 'text-green-600 dark:text-green-400', failed: 'text-red-600 dark:text-red-400' })[props.status.state as string] ?? 'opacity-70',
)
</script>

<template>
  <div class="text-sm break-words min-w-0" :class="color" data-testid="status">Agent: {{ text }}</div>
</template>
