<script setup lang="ts">
import Feedback from './Feedback.vue'
const props = defineProps<{
  landscape: boolean; feedback: boolean; reducedMotion: boolean; replay: boolean; allowInput: () => boolean
}>()
defineEmits<{ stop: []; replay: [] }>()
function guard(event: Event) {
  if (!props.allowInput()) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
</script>

<template>
  <div class="learning-layout">
    <nav class="learning-controls" aria-label="Điều khiển phiên">
      <button class="icon-button stop-button" aria-label="Dừng phiên" @click="$emit('stop')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" stroke="none"/></svg>
      </button>
      <Feedback :visible="feedback && landscape" :reduced-motion="reducedMotion"/>
      <button v-if="replay && landscape" class="icon-button replay-button" aria-label="Nghe lại hướng dẫn" @click="$emit('replay')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Zm12-1q4 4 0 8m3-11q7 7 0 14"/></svg>
      </button>
    </nav>
    <div v-show="landscape" class="game-board" @pointerdown.capture="guard" @pointermove.capture="guard"
      @pointerup.capture="guard" @click.capture="guard" @keydown.capture="guard" @keyup.capture="guard">
      <slot/>
    </div>
  </div>
</template>
