<script setup lang="ts">
import { localCues } from '../services/settings'
import type { Settings } from '../shared/contracts'

defineProps<{ settings: Settings; blocked: boolean; ready: boolean; clearing: boolean; notice: string }>()
const emit = defineEmits<{ update: [settings: Partial<Pick<Settings, 'audio' | 'reducedMotion'>>]; home: []; clear: [] }>()
function change(key: 'audio' | 'reducedMotion', event: Event) {
  emit('update', { [key]: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <div class="adult-shell adult-detail">
    <div class="settings-intro">
      <button type="button" class="icon-button" aria-label="Về trang chủ" :disabled="clearing" @click="$emit('home')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 6-6 6 6 6m-6-6h13"/></svg>
      </button>
      <h1>Cài đặt người lớn</h1>
    </div>
    <div class="settings-form">
      <p v-if="notice" role="alert" class="form-notice">{{ notice }}</p>
      <fieldset class="toggles" :disabled="blocked || !ready || clearing">
        <label>
          <input type="checkbox" :checked="settings.audio && localCues.size > 0" :disabled="localCues.size === 0" @change="change('audio', $event)">
          <span>Giọng nói tiếng Việt<small v-if="!localCues.size">Chưa có bản thu trên thiết bị.</small></span>
        </label>
        <label>
          <input type="checkbox" :checked="settings.reducedMotion" @change="change('reducedMotion', $event)">
          Giảm chuyển động
        </label>
      </fieldset>
      <div class="privacy">
        <span>Dữ liệu chỉ lưu trên thiết bị này.</span>
        <button type="button" :disabled="clearing" @click="$emit('clear')">Xóa dữ liệu trên thiết bị</button>
      </div>
    </div>
  </div>
</template>
