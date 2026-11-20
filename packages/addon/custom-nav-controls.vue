<script setup lang="ts">
import ReviewToggle from './components/ReviewToggle.vue'
import { isPlayMode } from './components/reviewState'

const play = isPlayMode(location.pathname, import.meta.env.BASE_URL)
</script>

<template>
  <ReviewToggle v-if="play" />
</template>
