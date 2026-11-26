<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Asset, GameProps } from '../../shared/contracts'
import { firstTargetOnDragPath } from './dragGeometry'
import type { Point, TargetRect } from './dragGeometry'
import { createShadowBoard, matchShadow } from './engine'
import type { ShadowBoard } from './engine'

const props = defineProps<GameProps>()
const emit = defineEmits<{ complete: [] }>()

interface Gesture {
  pointerId: number
  asset: Asset
  button: HTMLButtonElement
  start: Point
  artwork: DOMRect
  previousCenter: Point
  preview: Point | null
}

const dragThreshold = 6
const area = ref<HTMLElement | null>(null)
const board = shallowRef<ShadowBoard | null>(null)
const matched = shallowRef<readonly string[]>([])
const selected = ref<string | null>(null)
const gesture = shallowRef<Gesture | null>(null)
const playable = computed(() => props.active && board.value !== null && matched.value.length < board.value.sources.length)
let observer: ResizeObserver | undefined

function contains(element: HTMLElement, point: Point) {
  const { left, right, top, bottom } = element.getBoundingClientRect()
  return point.x >= left && point.x < right && point.y >= top && point.y < bottom
}

function unmatchedTargetRects(element: HTMLElement) {
  const targets: TargetRect[] = []
  for (const button of element.querySelectorAll<HTMLButtonElement>('button[data-shadow-side="target"]')) {
    const id = button.dataset.shadowId
    if (id === undefined || matched.value.includes(id)) continue

    const { left, top, right, bottom } = button.getBoundingClientRect()
    targets.push({ id, left, top, right, bottom })
  }
  return targets
}

function select(id: string) {
  if (!playable.value || matched.value.includes(id)) return
  selected.value = selected.value === id ? null : id
}

function attempt(sourceId: string, targetId: string | undefined) {
  selected.value = null
  if (!playable.value || !board.value || targetId === undefined) return

  const next = matchShadow(matched.value, sourceId, targetId, board.value)
  if (next === matched.value) return

  matched.value = next
  if (next.length === board.value.sources.length) emit('complete')
}

function onSourceClick(event: MouseEvent, id: string) {
  // Pointer taps are resolved on release. Keyboard and assistive clicks have detail zero.
  if (event.detail === 0 && !gesture.value) select(id)
}

function onTargetClick(id: string) {
  if (selected.value !== null && !gesture.value) attempt(selected.value, id)
}

function onPointerDown(event: PointerEvent, asset: Asset) {
  if (
    !playable.value || gesture.value || !event.isPrimary ||
    event.button !== 0 || matched.value.includes(asset.id)
  ) return

  const button = event.currentTarget as HTMLButtonElement
  const artwork = button.querySelector('img')?.getBoundingClientRect() ?? button.getBoundingClientRect()
  gesture.value = {
    pointerId: event.pointerId,
    asset,
    button,
    start: { x: event.clientX, y: event.clientY },
    artwork,
    previousCenter: { x: artwork.left + artwork.width / 2, y: artwork.top + artwork.height / 2 },
    preview: null,
  }
  button.setPointerCapture?.(event.pointerId)
}

function onDragPointer(event: PointerEvent) {
  const current = gesture.value
  const element = area.value
  if (!playable.value || !current || current.pointerId !== event.pointerId || !element) return

  const released = event.type === 'pointerup'
  const point = { x: event.clientX, y: event.clientY }
  const dx = point.x - current.start.x
  const dy = point.y - current.start.y
  if (!current.preview && Math.hypot(dx, dy) < dragThreshold) {
    if (released) {
      releaseGesture()
      if (contains(current.button, point)) select(current.asset.id)
      else selected.value = null
    }
    return
  }

  const artwork = current.artwork
  const center = { x: artwork.left + artwork.width / 2 + dx, y: artwork.top + artwork.height / 2 + dy }
  const targetId = firstTargetOnDragPath(current.previousCenter, center, artwork, unmatchedTargetRects(element))
  if (targetId !== undefined || released) {
    releaseGesture()
    attempt(current.asset.id, targetId)
    return
  }

  const { left, top } = element.getBoundingClientRect()
  selected.value = null
  gesture.value = {
    ...current,
    previousCenter: center,
    preview: { x: artwork.left - left + dx, y: artwork.top - top + dy },
  }
}

function releaseGesture() {
  const current = gesture.value
  gesture.value = null
  if (current?.button.hasPointerCapture?.(current.pointerId)) {
    current.button.releasePointerCapture(current.pointerId)
  }
}

function clearInteraction() {
  releaseGesture()
  selected.value = null
}

function onPointerCancel(event: PointerEvent) {
  if (gesture.value?.pointerId === event.pointerId) clearInteraction()
}

function targetLabel(asset: Asset) {
  if (matched.value.includes(asset.id)) return `Đã ghép ${asset.labelVi}`
  return `Bóng ${asset.labelVi}`
}

watch(() => props.roundKey, () => {
  clearInteraction()
  matched.value = []
  try {
    board.value = createShadowBoard(props.assets, props.roundSize, Math.random)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    board.value = null
  }
}, { immediate: true })

watch(() => props.active, clearInteraction, { flush: 'sync' })

onMounted(() => {
  const element = area.value
  if (element && typeof ResizeObserver !== 'undefined') {
    let size = element.getBoundingClientRect()
    observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect()
      if (next.width !== size.width || next.height !== size.height) clearInteraction()
      size = next
    })
    observer.observe(element)
  }
  window.addEventListener('resize', clearInteraction)
})

onBeforeUnmount(() => {
  clearInteraction()
  observer?.disconnect()
  window.removeEventListener('resize', clearInteraction)
})
</script>

<template>
  <section
    ref="area"
    class="shadow-game"
    aria-label="Ghép hình với bóng"
    @pointermove="onDragPointer"
    @pointerup="onDragPointer"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
  >
    <template v-if="board">
      <div class="shadow-row">
        <button
          v-for="asset in board.sources"
          :key="asset.id"
          type="button"
          class="shadow-tile shadow-source"
          data-shadow-side="source"
          :data-shadow-id="asset.id"
          :data-shadow-empty="matched.includes(asset.id) ? '' : null"
          :aria-label="`Hình ${asset.labelVi}`"
          :aria-pressed="selected === asset.id"
          :aria-hidden="matched.includes(asset.id) ? 'true' : undefined"
          :disabled="!playable || matched.includes(asset.id)"
          @click="onSourceClick($event, asset.id)"
          @pointerdown="onPointerDown($event, asset)"
        >
          <img
            v-if="!matched.includes(asset.id)"
            class="shadow-art"
            :class="{ 'shadow-art--lifted': gesture?.preview && gesture.asset.id === asset.id }"
            :src="asset.image"
            alt=""
            draggable="false"
          >
        </button>
      </div>
      <div class="shadow-row">
        <button
          v-for="asset in board.targets"
          :key="asset.id"
          type="button"
          class="shadow-tile shadow-target"
          data-shadow-side="target"
          :data-shadow-id="asset.id"
          :data-shadow-matched="matched.includes(asset.id) ? '' : null"
          :aria-label="targetLabel(asset)"
          :disabled="!playable || matched.includes(asset.id)"
          @click="onTargetClick(asset.id)"
        >
          <span
            v-if="!matched.includes(asset.id)"
            class="shadow-art shadow-silhouette"
            :style="{ '--shadow-image': `url(&quot;${asset.image}&quot;)` }"
            aria-hidden="true"
          />
          <img v-else class="shadow-art" :src="asset.image" alt="" draggable="false">
        </button>
      </div>
    </template>
    <img
      v-if="gesture?.preview"
      class="shadow-drag"
      data-shadow-drag
      :src="gesture.asset.image"
      :style="{
        left: `${gesture.preview.x}px`,
        top: `${gesture.preview.y}px`,
        width: `${gesture.artwork.width}px`,
        height: `${gesture.artwork.height}px`,
      }"
      alt=""
      draggable="false"
    >
  </section>
</template>

<style src="./shadow.css"></style>
