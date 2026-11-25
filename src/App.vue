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
import HomeView from './views/HomeView.vue'
import ParentSettings from './views/ParentSettings.vue'
import SessionEnd from './views/SessionEnd.vue'

const { screen, settings, session, notice, blocked, clearing, landscape, boardHeight, roundKey, interactive,
  feedback, settingsReady, start, stop, complete, allowInput, playInputCue, openSettings, updateSettings, clearData, home } = useSession()
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
    <div class="safe-area-probe" aria-hidden="true"></div>
    <HomeView v-if="screen === 'home'" @select="openSettings"/>
    <ParentSettings v-else-if="screen === 'settings'" :settings="settings" :board-height="boardHeight"
      :blocked="blocked" :ready="settingsReady" :clearing="clearing" :notice="notice" @home="home" @update="updateSettings" @start="start" @clear="clearData"/>
    <GameLayout v-else-if="screen === 'learning' && session" :landscape="landscape" :feedback="feedback"
      :reduced-motion="session.settings.reducedMotion" :allow-input="allowInput"
      :replay="session.settings.audio && localCues.has(session.settings.game)" @stop="stop" @replay="playInputCue(session.settings.game)">
      <component :is="games[session.settings.game]" v-if="roundKey" :settings="session.settings" :assets="assets" :active="interactive"
        :round-key="roundKey" @complete="complete" @count="countCue"/>
    </GameLayout>
    <SessionEnd v-else-if="screen === 'end'" @settings="openSettings()"/>
  </main>
</template>
