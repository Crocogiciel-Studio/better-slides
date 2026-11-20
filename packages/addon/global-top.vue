<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RunStatus as Status, StackItem } from '@better-slide/shared'
import { createClient } from './components/api'
import CommentPopover from './components/CommentPopover.vue'
import RunStatus from './components/RunStatus.vue'
import { startSelection, type ElementPick } from './components/selection'
import StackPanel from './components/StackPanel.vue'

const api = createClient()
const selecting = ref(false)
const pending = ref<{ pick: ElementPick; x: number; y: number }>()
const comments = ref<StackItem[]>([])
const locked = ref(false)
const status = ref<Status>({ state: 'idle' })
const error = ref('')

const running = computed(() => status.value.state === 'running' || locked.value)
const canSend = computed(() => comments.value.length > 0 && !running.value)

let stopSelection: (() => void) | undefined
let unfollow: (() => void) | undefined

async function guarded(action: () => Promise<unknown>) {
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function refresh() {
  await guarded(async () => {
    const data = await api.list()
    comments.value = data.comments
    locked.value = data.locked
  })
}

watch(selecting, (on) => {
  stopSelection?.()
  pending.value = undefined
  stopSelection = on
    ? startSelection((pick, element) => {
        const rect = element.getBoundingClientRect()
        pending.value = {
          pick,
          x: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
          y: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 180)),
        }
      })
    : undefined
})

onMounted(() => {
  refresh()
  unfollow = api.follow((s) => {
    status.value = s
    refresh()
  })
})
onBeforeUnmount(() => {
  stopSelection?.()
  unfollow?.()
})

const add = (note: string) =>
  guarded(async () => {
    if (!pending.value) return
    await api.add({ ...pending.value.pick, note })
    pending.value = undefined
    await refresh()
  })
const remove = (id: string) => guarded(async () => (await api.remove(id), refresh()))
const cancel = () => guarded(() => api.cancel())
const send = () => guarded(async () => (await api.send(), refresh()))
</script>

<template>
  <div class="panel" data-better-slide-ui data-testid="panel">
    <div class="bar">
      <strong>Review</strong>
      <button class="toggle" data-testid="toggle" @click="selecting = !selecting">
        {{ selecting ? 'Stop commenting' : 'Comment' }}
      </button>
    </div>
    <StackPanel :comments="comments" :locked="locked" @remove="remove" />
    <div class="run">
      <RunStatus :status="status" />
      <button v-if="status.state === 'running'" class="cancel" data-testid="cancel" @click="cancel">Cancel</button>
    </div>
    <div v-if="error" class="error" data-testid="error">{{ error }}</div>
    <button class="send" data-testid="send" :disabled="!canSend" @click="send">Send stack</button>
  </div>
  <CommentPopover
    v-if="pending"
    :pick="pending.pick"
    :x="pending.x"
    :y="pending.y"
    @add="add"
    @cancel="pending = undefined"
  />
</template>

<style scoped>
.panel {
  position: fixed;
  right: 8px;
  bottom: 8px;
  z-index: 2000;
  width: 300px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.96);
  color: #111;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  font: 12px sans-serif;
}
.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
button {
  padding: 3px 10px;
  border: 1px solid #2563eb;
  border-radius: 4px;
  background: #2563eb;
  color: white;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.run {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cancel {
  border-color: #b91c1c;
  background: #b91c1c;
}
.send {
  width: 100%;
  margin-top: 4px;
}
.error {
  color: #b91c1c;
}
</style>
