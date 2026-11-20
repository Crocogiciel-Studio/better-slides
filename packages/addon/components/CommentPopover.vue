<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { Pick } from './selection'

defineProps<{ pick: Pick; x: number; y: number }>()
const emit = defineEmits<{ add: [note: string]; cancel: [] }>()

const note = ref('')
const input = ref<HTMLTextAreaElement>()
onMounted(() => nextTick(() => input.value?.focus()))

function submit() {
  if (note.value.trim()) emit('add', note.value)
}
</script>

<template>
  <div class="popover" data-better-slide-ui :style="{ left: `${x}px`, top: `${y}px` }">
    <div class="target">Slide {{ pick.slide }} · {{ pick.text }}</div>
    <textarea
      ref="input"
      v-model="note"
      placeholder="What should change?"
      rows="3"
      @keydown.enter.exact.prevent="submit"
      @keydown.esc="emit('cancel')"
    />
    <div class="actions">
      <button class="add" :disabled="!note.trim()" @click="submit">Add</button>
      <button @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.popover {
  position: fixed;
  z-index: 2100;
  width: 280px;
  padding: 8px;
  border-radius: 6px;
  background: white;
  color: #111;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  font: 13px sans-serif;
}
.target {
  margin-bottom: 6px;
  color: #555;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
textarea {
  box-sizing: border-box;
  width: 100%;
  font: inherit;
  color: inherit;
  background: white;
}
.actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
button {
  padding: 3px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f5f5f5;
  color: #111;
  cursor: pointer;
}
.add {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
