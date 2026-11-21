<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { isWholeSlide } from '@better-slide/shared'
import type { ElementPick } from './selection'

const props = defineProps<{ pick: ElementPick }>()
const emit = defineEmits<{ add: [note: string]; cancel: []; wholeSlide: [] }>()

const note = ref('')
const field = ref<HTMLTextAreaElement>()

/** The author types at once; `preventScroll` keeps the sidebar from moving. */
const focusNote = () => nextTick(() => field.value?.focus({ preventScroll: true }))
onMounted(focusNote)
// A new target keeps the note being typed: the author may have clicked the wrong element first.
watch(() => props.pick, focusNote)

function submit() {
  if (note.value.trim()) emit('add', note.value.trim())
}
</script>

<template>
  <section class="p-3 border-b border-main bg-active flex flex-col gap-2" data-testid="composer">
    <div class="text-xs opacity-70">Slide {{ pick.slide }}</div>
    <div class="text-sm font-medium break-words" data-testid="composer-target">{{ isWholeSlide(pick) ? 'Whole slide' : pick.text }}</div>
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
      <button
        v-if="!isWholeSlide(pick)"
        class="ml-auto px-2 py-1 rounded text-xs border border-main hover:bg-active"
        title="Comment on the whole slide instead of this element"
        data-testid="composer-whole-slide"
        @click="emit('wholeSlide')"
      >
        Whole slide
      </button>
    </div>
  </section>
</template>
