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
</script>

<template>
  <div class="status" :class="status.state" data-testid="status">Agent: {{ text }}</div>
</template>

<style scoped>
.status {
  padding: 2px 0;
}
.running {
  color: #b45309;
}
.finished {
  color: #15803d;
}
.failed {
  color: #b91c1c;
}
</style>
