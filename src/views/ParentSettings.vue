<script setup lang="ts">
import { computed } from 'vue'
import { getAssets } from '../assets/catalog'
import { gameNames, levelLabel, levels, localCues, minutes, roundLimits, themeNames, unavailableReason } from '../services/settings'
import type { Settings } from '../shared/contracts'

const props = defineProps<{ settings: Settings; boardHeight: number; blocked: boolean; ready: boolean; clearing: boolean; notice: string }>()
const emit = defineEmits<{ update: [settings: Settings]; start: []; home: []; clear: [] }>()
const unavailable = computed(() => unavailableReason(props.settings, props.boardHeight))
const capacityNotice = computed(() => {
  if (unavailable.value) return unavailable.value
  const limited = levels.some(level => unavailableReason({ ...props.settings, level }, props.boardHeight))
  return limited && props.settings.game === 'connect' ? 'Một số mức cần màn hình cao hơn hoặc nhiều hình hơn trong chủ đề.' : ''
})
const assets = computed(() => getAssets(props.settings.theme))
function change(key: keyof Settings, event: Event) {
  const field = event.target as HTMLSelectElement | HTMLInputElement
  let value: string | number | boolean = field.value
  if (field instanceof HTMLInputElement) value = field.checked
  else if (key === 'level' || key === 'minutes' || key === 'roundLimit') value = Number(value)
  emit('update', { ...props.settings, [key]: value })
}
</script>

<template>
  <div class="adult-shell">
    <header class="adult-bar">
      <span class="brand"><i aria-hidden="true"></i>Little Steps Kidz</span>
      <button class="secondary" :disabled="clearing" @click="$emit('home')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 6-6 6 6 6m-6-6h13"/></svg>Về trang chủ
      </button>
    </header>
    <div class="settings-layout">
      <aside class="settings-intro">
        <div class="adult-title"><p>Dành cho người lớn</p><h1>Chuẩn bị phiên học</h1></div>
        <div class="theme-preview" aria-hidden="true">
          <img v-for="asset in assets.slice(0, 3)" :key="asset.id" :src="asset.image" alt="">
        </div>
        <p class="session-explanation">Phiên kết thúc khi hết thời gian hoặc đủ số lượt. Bé có thể dừng bất cứ lúc nào.</p>
      </aside>
      <form class="settings-form" @submit.prevent="$emit('start')">
        <p v-if="notice" role="alert" class="form-notice">{{ notice }}</p>
        <fieldset :disabled="blocked || !ready || clearing">
          <div class="form-grid">
            <label>Trò chơi<select :value="settings.game" @change="change('game', $event)"><option v-for="(name, id) in gameNames" :key="id" :value="id">{{ name }}</option></select></label>
            <label>Chủ đề<select :value="settings.theme" @change="change('theme', $event)"><option v-for="(name, id) in themeNames" :key="id" :value="id">{{ name }}</option></select></label>
            <label class="field-wide">Mức độ<select :value="settings.level" @change="change('level', $event)">
              <option v-for="level in levels" :key="level" :value="level" :disabled="!!unavailableReason({ ...settings, level }, boardHeight)">{{ levelLabel(settings.game, level) }}</option>
            </select></label>
            <p v-if="capacityNotice" class="field-note field-wide">{{ capacityNotice }}</p>
            <label>Thời lượng<select :value="settings.minutes" @change="change('minutes', $event)"><option v-for="n in minutes" :key="n" :value="n">{{ n }} phút</option></select></label>
            <label>Số lượt tối đa<select :value="settings.roundLimit" @change="change('roundLimit', $event)"><option v-for="n in roundLimits" :key="n" :value="n">{{ n }} lượt</option></select></label>
          </div>
          <div class="toggles">
            <label><input type="checkbox" :checked="settings.audio && localCues.size > 0" :disabled="localCues.size === 0" @change="change('audio', $event)">
              <span>Giọng nói tiếng Việt<small v-if="!localCues.size">Chưa có bản thu trên thiết bị.</small></span>
            </label>
            <label><input type="checkbox" :checked="settings.reducedMotion" @change="change('reducedMotion', $event)">Giảm chuyển động</label>
          </div>
          <button class="primary" type="submit" :disabled="!ready || !!unavailable"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>Bắt đầu</button>
        </fieldset>
        <div class="privacy"><span>Dữ liệu chỉ lưu trên thiết bị này.</span>
          <button type="button" :disabled="clearing" @click="$emit('clear')">Xóa dữ liệu trên thiết bị</button>
        </div>
      </form>
    </div>
  </div>
</template>
