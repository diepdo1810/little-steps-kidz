<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import { getAssets } from './assets/catalog'
import GameLayout from './components/GameLayout.vue'
import ConnectGame from './games/connect/ConnectGame.vue'
import CountingGame from './games/counting/CountingGame.vue'
import ShadowGame from './games/shadow/ShadowGame.vue'
import { localCues } from './services/settings'
import { useSession } from './session/useSession'
import AdultPreferences from './views/AdultPreferences.vue'
import HomeView from './views/HomeView.vue'
import ParentSettings from './views/ParentSettings.vue'
import SessionEnd from './views/SessionEnd.vue'

const { screen, settings, session, notice, blocked, clearing, landscape, roundKey, roundSize, interactive,
  feedback, settingsReady, start, stop, complete, allowInput, playInputCue, openSettings, openPreferences, updateSettings, clearData, home } = useSession()
const games = { connect: ConnectGame, shadow: ShadowGame, counting: CountingGame }
const assets = computed(() => session.value ? getAssets(session.value.settings.theme) : [])
function countCue(count: number) {
  playInputCue(`number-${count}`)
}
onMounted(() => {
  if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Learning still works online if this browser disallows offline storage.
    })
  }
})
</script>

<template>
  <main class="app-shell" aria-label="Little Steps Kidz">
    <GameLayout v-if="screen === 'learning' && session" :landscape="landscape" :feedback="feedback"
      :reduced-motion="session.settings.reducedMotion" :allow-input="allowInput"
      :replay="session.settings.audio && localCues.has(session.settings.game)" @stop="stop" @replay="playInputCue(session.settings.game)">
      <component :is="games[session.settings.game]" v-if="roundKey" :settings="session.settings" :assets="assets" :active="interactive"
        :round-key="roundKey" :round-size="roundSize" @complete="complete" @count="countCue"/>
    </GameLayout>
    <template v-else-if="landscape">
      <HomeView v-if="screen === 'home'" @select="openSettings" @preferences="openPreferences"/>
      <ParentSettings v-else-if="screen === 'settings'" :settings="settings" :blocked="blocked"
        :ready="settingsReady" :notice="notice" @home="home" @update="updateSettings" @start="start"/>
      <AdultPreferences v-else-if="screen === 'preferences'" :settings="settings" :blocked="blocked"
        :ready="settingsReady" :clearing="clearing" :notice="notice" @home="home" @update="updateSettings" @clear="clearData"/>
      <SessionEnd v-else-if="screen === 'end'" @settings="openSettings()"/>
    </template>
    <div v-if="!landscape" class="orientation-prompt">
      <svg role="img" aria-label="Xoay ngang thiết bị" viewBox="0 0 100 100">
        <rect x="18" y="32" width="64" height="37" rx="7" transform="rotate(-25 50 50)"/>
        <path d="M18 27a37 37 0 0 1 55-7m-3-10 4 11-12 3M82 73a37 37 0 0 1-55 7m3 10-4-11 12-3"/>
      </svg>
    </div>
  </main>
</template>
