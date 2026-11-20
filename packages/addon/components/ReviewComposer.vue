<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ElementPick } from './selection'

const props = defineProps<{ pick: ElementPick }>()
const emit = defineEmits<{ add: [note: string]; cancel: [] }>()

const note = ref('')
const field = ref<HTMLTextAreaElement>()

// A new selection starts a new note.
watch(() => props.pick, () => (note.value = ''))

function submit() {
  if (note.value.trim()) emit('add', note.value.trim())
}
</script>

<template>
  <section class="p-3 border-b border-main bg-active flex flex-col gap-2" data-testid="composer">
    <div class="text-xs opacity-70">Slide {{ pick.slide }}</div>
    <div class="text-sm font-medium break-words">{{ pick.text }}</div>
    <textarea
      ref="field"
      v-model="note"
      rows="3"
      placeholder="What should change? (Enter to add, Esc to leave the field)"
      class="w-full p-2 text-sm rounded border border-main bg-main text-main resize-y"
      data-testid="note"
      @keydown.enter.exact.prevent="submit"
      @keydown.esc.stop="field?.blur()"
    />
    <div class="flex gap-2">
      <button class="px-3 py-1 rounded text-sm bg-primary text-white disabled:opacity-40" :disabled="!note.trim()" data-testid="add" @click="submit">
        Add
      </button>
      <button class="px-3 py-1 rounded text-sm border border-main hover:bg-active" data-testid="dismiss" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>
