<script setup lang="ts">
import type { StackItem } from '@better-slide/shared'

defineProps<{ comments: StackItem[]; locked: boolean }>()
const emit = defineEmits<{ remove: [id: string] }>()
</script>

<template>
  <ul class="stack" data-testid="stack">
    <li v-if="!comments.length" class="empty">No comment yet. Click Comment, then an element.</li>
    <li v-for="c in comments" :key="c.id" class="item">
      <span class="label">slide {{ c.slide }} · "{{ c.text }}" · {{ c.note }}</span>
      <button v-if="!locked" class="remove" @click="emit('remove', c.id)">remove</button>
    </li>
  </ul>
</template>

<style scoped>
.stack {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 180px;
  overflow: auto;
}
.item {
  display: flex;
  gap: 6px;
  justify-content: space-between;
  padding: 2px 0;
}
.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  color: #666;
}
.remove {
  flex: none;
  border: 0;
  background: none;
  color: #b91c1c;
  cursor: pointer;
}
</style>
