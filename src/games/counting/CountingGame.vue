<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { GameProps } from '../../shared/contracts'
import { createQuestion, markCounted } from './engine'
import type { CountingQuestion } from './engine'

const props = defineProps<GameProps>()
const emit = defineEmits<{ complete: []; count: [count: number] }>()

const question = shallowRef<CountingQuestion | null>(null)
const counted = shallowRef<readonly number[]>([])
const locked = ref(false)
const playable = computed(() => props.active && !locked.value)

function countObject(index: number) {
  if (!playable.value || !question.value) return

  const next = markCounted(counted.value, index, question.value.quantity)
  if (next === counted.value) return

  counted.value = next
  emit('count', next.length)
}

function answer(choice: number) {
  if (!playable.value || choice !== question.value?.quantity) return

  locked.value = true
  emit('complete')
}

watch(() => props.roundKey, () => {
  counted.value = []
  locked.value = false
  question.value = props.assets.length ? createQuestion(props.assets, props.settings.level, Math.random) : null
}, { immediate: true })
</script>

<template>
  <section class="counting-game" aria-label="Đếm đồ vật">
    <template v-if="question">
      <div class="counting-objects" role="group" aria-label="Hình để đếm">
        <button
          v-for="(position, index) in question.quantity"
          :key="position"
          type="button"
          class="counting-object"
          :aria-label="`Hình ${question.asset.labelVi} ${position}`"
          :aria-pressed="counted.includes(index)"
          :disabled="!playable"
          @click="countObject(index)"
        >
          <img :src="question.asset.image" alt="" draggable="false">
        </button>
      </div>
      <div class="counting-choices" role="group" aria-label="Chọn số lượng">
        <button
          v-for="choice in question.choices"
          :key="choice"
          type="button"
          class="counting-choice"
          :class="{ 'counting-choice--correct': locked && choice === question.quantity }"
          :disabled="!playable"
          @click="answer(choice)"
        >{{ choice }}</button>
      </div>
    </template>
  </section>
</template>

<style src="./counting.css"></style>
