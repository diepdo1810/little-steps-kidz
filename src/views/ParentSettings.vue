<script setup lang="ts">
import { computed } from 'vue'
import { getAssets } from '../assets/catalog'
import { gameNames, roundLimits, themeNames, unavailableReason } from '../services/settings'
import type { Settings, ThemeId } from '../shared/contracts'

const props = defineProps<{ settings: Settings; blocked: boolean; ready: boolean; notice: string }>()
const emit = defineEmits<{ update: [settings: Partial<Pick<Settings, 'theme' | 'roundLimit'>>]; start: []; home: [] }>()
const unavailable = computed(() => unavailableReason(props.settings))
const preview = computed(() => getAssets(props.settings.theme).slice(0, 3))
function changeTheme(event: Event) {
  const theme = (event.target as HTMLSelectElement).value as ThemeId
  emit('update', { theme })
}
function changeRounds(event: Event) {
  const roundLimit = Number((event.target as HTMLSelectElement).value)
  emit('update', { roundLimit })
}
</script>

<template>
  <div class="adult-shell adult-detail">
    <div class="settings-intro">
      <button type="button" class="icon-button" aria-label="Về trang chủ" @click="$emit('home')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 6-6 6 6 6m-6-6h13"/></svg>
      </button>
      <h1>{{ gameNames[settings.game] }}</h1>
      <div class="theme-preview" aria-hidden="true">
        <img v-for="asset in preview" :key="asset.id" :src="asset.image" alt="">
      </div>
    </div>
    <form class="settings-form" @submit.prevent="$emit('start')">
      <p v-if="notice || unavailable" role="alert" class="form-notice">{{ notice || unavailable }}</p>
      <fieldset :disabled="blocked || !ready">
        <div class="form-grid">
          <label>Chủ đề
            <select :value="settings.theme" @change="changeTheme">
              <option v-for="(name, id) in themeNames" :key="id" :value="id">{{ name }}</option>
            </select>
          </label>
          <label>Số lượt tối đa
            <select :value="settings.roundLimit" @change="changeRounds">
              <option v-for="n in roundLimits" :key="n" :value="n">{{ n }} lượt</option>
            </select>
          </label>
          <button class="primary" type="submit" :disabled="!!unavailable">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>Bắt đầu
          </button>
        </div>
      </fieldset>
    </form>
  </div>
</template>
