<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { startSelection, UI_ATTRIBUTE, type Pick } from './components/selection'

const selecting = ref(false)
const picked = ref<Pick>()
let stop: (() => void) | undefined

watch(selecting, (on) => {
  stop?.()
  stop = on ? startSelection((pick) => (picked.value = pick)) : undefined
})
onBeforeUnmount(() => stop?.())
</script>

<template>
  <div class="better-slide" :[UI_ATTRIBUTE]="''">
    <button class="toggle" @click="selecting = !selecting">
      {{ selecting ? 'Stop commenting' : 'Comment' }}
    </button>
    <pre v-if="picked" class="picked">{{ JSON.stringify(picked) }}</pre>
  </div>
</template>

<style scoped>
.better-slide {
  position: fixed;
  top: 4px;
  right: 8px;
  z-index: 2000;
  font: 12px sans-serif;
}
.toggle {
  padding: 2px 8px;
  border-radius: 4px;
  border: 0;
  background: #2563eb;
  color: white;
  cursor: pointer;
}
.picked {
  max-width: 320px;
  white-space: pre-wrap;
  background: white;
  color: black;
  padding: 4px;
}
</style>
