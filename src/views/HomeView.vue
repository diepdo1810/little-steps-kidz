<script setup lang="ts">
import { gameNames } from '../services/settings'
import type { GameId } from '../shared/contracts'
defineEmits<{ select: [game?: GameId] }>()
const cards: { game: GameId; image: string }[] = [
  { game: 'connect', image: 'cow' }, { game: 'shadow', image: 'starfish' }, { game: 'counting', image: 'apple' },
]
</script>

<template>
  <div class="adult-shell">
    <header class="adult-bar">
      <span class="brand"><i aria-hidden="true"></i>Little Steps Kidz</span>
      <button class="secondary" @click="$emit('select')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>
        Cài đặt người lớn
      </button>
    </header>
    <div class="adult-title"><p>Dành cho người lớn</p><h1>Chọn trò chơi</h1></div>
    <div class="game-cards">
      <button v-for="card in cards" :key="card.game" class="game-card" :class="'card-' + card.game"
        :aria-label="gameNames[card.game]" @click="$emit('select', card.game)">
        <span class="card-art"><img :src="'/assets/images/' + card.image + '.svg'" alt=""></span>
        <span class="card-title">{{ gameNames[card.game] }}<span aria-hidden="true">↗</span></span>
      </button>
    </div>
  </div>
</template>
