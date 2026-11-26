<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { MAX_ROUND_ITEMS } from '../../assets/catalog'
import type { GameProps } from '../../shared/contracts'
import { connectPair, createBoard, maxPairsForHeight, rotateIfAligned } from './engine'
import type { Board } from './engine'

const props = defineProps<GameProps>()
const emit = defineEmits<{ complete: []; stop: [] }>()

const sides = ['left', 'right'] as const
type Side = (typeof sides)[number]

interface Endpoint {
  side: Side
  id: string
}

interface Point {
  x: number
  y: number
}

interface Gesture {
  pointerId: number
  source: Endpoint
  button: HTMLButtonElement
  start: Point
  point: Point
  dragged: boolean
}

const dragThreshold = 6
const dragSnapRadius = 40
const roomyRowHeight = 80
const labels: Record<Side, string> = { left: 'Bên trái', right: 'Bên phải' }
const area = ref<HTMLElement | null>(null)
const canvas = ref<SVGSVGElement | null>(null)
const board = shallowRef<Board | null>(null)
const pageSize = ref(MAX_ROUND_ITEMS)
const matched = shallowRef<readonly string[]>([])
const selected = shallowRef<Endpoint | null>(null)
const gesture = shallowRef<Gesture | null>(null)
const origin = shallowRef<Point>({ x: 0, y: 0 })
const anchors = shallowRef<Record<Side, Map<string, Point>>>({ left: new Map(), right: new Map() })
let observer: ResizeObserver | undefined
let measured: DOMRect | undefined

const pageRanges = computed(() => {
  if (!board.value) return []
  const pages = Math.ceil(board.value.left.length / pageSize.value)
  const baseSize = Math.floor(board.value.left.length / pages)
  const largerPages = board.value.left.length % pages
  let start = 0
  return Array.from({ length: pages }, (_, page) => {
    const size = baseSize + (page < largerPages ? 1 : 0)
    const range = { start, end: start + size }
    start += size
    return range
  })
})
const visibleRange = computed(() => {
  if (!board.value) return { start: 0, end: 0 }
  const next = board.value.left.findIndex(({ id }) => !matched.value.includes(id))
  const index = next === -1 ? board.value.left.length - 1 : next
  return pageRanges.value.find(({ start, end }) => index >= start && index < end) ?? { start: 0, end: 0 }
})
const visibleBoard = computed(() => {
  if (!board.value) return null
  const left = board.value.left.slice(visibleRange.value.start, visibleRange.value.end)
  const ids = new Set(left.map(({ id }) => id))
  const right = board.value.right.filter(({ id }) => ids.has(id))
  return { left, right: rotateIfAligned(left, right) }
})

const playable = computed(() => props.active && board.value !== null && matched.value.length < board.value.left.length)
const lines = computed(() => matched.value.flatMap((id) => {
  const start = anchors.value.left.get(id)
  const end = anchors.value.right.get(id)
  return start && end ? [{ id, start, end }] : []
}))
const preview = computed(() => {
  const current = gesture.value
  if (!current?.dragged) return null

  const { source, point } = current
  const start = anchors.value[source.side].get(source.id)
  const end = { x: point.x - origin.value.x, y: point.y - origin.value.y }
  return start ? { start, end } : null
})

function targetButtons() {
  return area.value?.querySelectorAll<HTMLButtonElement>('.connect-target') ?? []
}

function endpointOf(button: HTMLButtonElement): Endpoint | null {
  const { connectSide: side, connectId: id } = button.dataset
  return (side === 'left' || side === 'right') && id ? { side, id } : null
}

function measureAnchors() {
  if (!canvas.value) return

  const svg = canvas.value.getBoundingClientRect()
  const next = { left: new Map<string, Point>(), right: new Map<string, Point>() }
  for (const button of targetButtons()) {
    const endpoint = endpointOf(button)
    const anchor = button.querySelector('.connect-anchor')
    if (!endpoint || !anchor) continue

    const rect = anchor.getBoundingClientRect()
    next[endpoint.side].set(endpoint.id, {
      x: rect.left + rect.width / 2 - svg.left,
      y: rect.top + rect.height / 2 - svg.top,
    })
  }
  origin.value = { x: svg.left, y: svg.top }
  anchors.value = next
}

function measureBoard() {
  const size = area.value?.getBoundingClientRect()
  if (size?.width && size.height && (!measured || size.width !== measured.width || size.height !== measured.height ||
    size.x !== measured.x || size.y !== measured.y)) {
    clearInteraction()
    measured = size
    pageSize.value = Math.max(1, maxPairsForHeight(size.height, MAX_ROUND_ITEMS, roomyRowHeight))
  }
  measureAnchors()
}

function targetAt(point: Point, sourceSide: Side, dragged: boolean): Endpoint | null {
  // The event target stays at the source while it holds pointer capture.
  for (const button of targetButtons()) {
    const rect = button.getBoundingClientRect()
    if (point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom) {
      return endpointOf(button)
    }
  }
  if (!dragged) return null

  let nearest: { endpoint: Endpoint; distance: number } | undefined
  let tied = false
  for (const button of targetButtons()) {
    if (button.disabled) continue
    const endpoint = endpointOf(button)
    if (!endpoint || endpoint.side === sourceSide) continue
    const rect = button.getBoundingClientRect()
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
    const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom)
    const distance = Math.hypot(dx, dy)
    if (!nearest || distance < nearest.distance) {
      nearest = { endpoint, distance }
      tied = false
    } else if (distance === nearest.distance) {
      tied = true
    }
  }
  return nearest && !tied && nearest.distance <= dragSnapRadius ? nearest.endpoint : null
}

function isSelected(side: Side, id: string) {
  return selected.value?.side === side && selected.value.id === id
}

function commit(source: Endpoint, target: Endpoint) {
  if (!playable.value || !board.value || source.side === target.side) return

  const next = connectPair(matched.value, source.id, target.id, board.value)
  if (next === matched.value) return

  matched.value = next
  if (next.length === board.value.left.length) emit('complete')
}

function select(endpoint: Endpoint) {
  if (!playable.value || matched.value.includes(endpoint.id)) return

  const source = selected.value
  if (source && source.side !== endpoint.side) {
    selected.value = null
    commit(source, endpoint)
  } else {
    selected.value = isSelected(endpoint.side, endpoint.id) ? null : endpoint
  }
}

function onClick(event: MouseEvent, side: Side, id: string) {
  // Pointer clicks follow pointerup; keyboard and assistive activation uses click.
  if (event.detail === 0 && !gesture.value) select({ side, id })
}

function pointOf(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY }
}

function moved(start: Point, point: Point) {
  return Math.hypot(point.x - start.x, point.y - start.y) >= dragThreshold
}

function onPointerDown(event: PointerEvent, side: Side, id: string) {
  if (
    !playable.value || gesture.value || !event.isPrimary ||
    event.button !== 0 || matched.value.includes(id)
  ) return

  const button = event.currentTarget as HTMLButtonElement
  const start = pointOf(event)
  gesture.value = { pointerId: event.pointerId, source: { side, id }, button, start, point: start, dragged: false }
  button.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  const current = gesture.value
  if (!playable.value || !current || current.pointerId !== event.pointerId) return

  const point = pointOf(event)
  if (!current.dragged && !moved(current.start, point)) return

  selected.value = null
  gesture.value = { ...current, point, dragged: true }
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

function onPointerUp(event: PointerEvent) {
  const current = gesture.value
  if (!current || current.pointerId !== event.pointerId) return

  releaseGesture()
  if (!playable.value) return

  const point = pointOf(event)
  const { source, start, dragged } = current
  const didDrag = dragged || moved(start, point)
  const target = targetAt(point, source.side, didDrag)
  if (target && target.side !== source.side) {
    selected.value = null
    commit(source, target)
  } else if (target?.id === source.id && !didDrag) {
    select(source)
  } else {
    selected.value = null
  }
}

function onPointerCancel(event: PointerEvent) {
  if (gesture.value?.pointerId === event.pointerId) clearInteraction()
}

watch(() => props.roundKey, () => {
  clearInteraction()
  matched.value = []
  try {
    board.value = createBoard(props.assets, props.roundSize, Math.random)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    board.value = null
  }
}, { immediate: true })

watch(() => props.active, clearInteraction, { flush: 'sync' })
watch(visibleBoard, () => {
  clearInteraction()
  measureAnchors()
}, { flush: 'post' })

onMounted(() => {
  measureBoard()
  if (area.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measureBoard)
    observer.observe(area.value)
  }
  window.addEventListener('resize', measureBoard)
})

onBeforeUnmount(() => {
  clearInteraction()
  observer?.disconnect()
  window.removeEventListener('resize', measureBoard)
})
</script>

<template>
  <section
    ref="area"
    class="connect-game"
    aria-label="Nối hình giống nhau"
    :style="{ '--connect-rows': visibleBoard?.left.length ?? 0 }"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
  >
    <svg ref="canvas" class="connect-lines" aria-hidden="true">
      <line
        v-for="{ id, start, end } in lines"
        :key="id"
        :x1="start.x"
        :y1="start.y"
        :x2="end.x"
        :y2="end.y"
      />
      <line
        v-if="preview"
        data-preview
        :x1="preview.start.x"
        :y1="preview.start.y"
        :x2="preview.end.x"
        :y2="preview.end.y"
      />
    </svg>
    <template v-if="visibleBoard">
      <div v-for="side in sides" :key="side" class="connect-column" :class="`connect-column--${side}`">
        <button
          v-for="asset in visibleBoard[side]"
          :key="asset.id"
          class="connect-target"
          type="button"
          :data-connect-side="side"
          :data-connect-id="asset.id"
          :aria-label="`${labels[side]}, ${asset.labelVi}`"
          :aria-pressed="isSelected(side, asset.id)"
          :disabled="!playable || matched.includes(asset.id)"
          :class="{ 'connect-target--matched': matched.includes(asset.id) }"
          @pointerdown="onPointerDown($event, side, asset.id)"
          @click="onClick($event, side, asset.id)"
        >
          <img :src="asset.image" alt="" draggable="false" />
          <span class="connect-anchor" aria-hidden="true" />
        </button>
      </div>
    </template>
  </section>
</template>

<style src="./connect.css"></style>
