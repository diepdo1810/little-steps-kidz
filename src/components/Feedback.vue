<script setup lang="ts">
defineProps<{ visible: boolean; reducedMotion: boolean }>()
</script>

<template>
  <span
    v-if="visible"
    class="round-feedback"
    :class="{ 'round-feedback--motion': !reducedMotion }"
    aria-hidden="true"
  />
</template>

<style scoped>
.round-feedback {
  display: inline-grid;
  place-items: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border: 2px solid currentColor;
  border-radius: 50%;
  color: var(--color-accent);
  background: var(--color-surface);
  pointer-events: none;
}

.round-feedback::before {
  content: '';
  inline-size: 1.05rem;
  block-size: 0.6rem;
  border-left: 0.15rem solid currentColor;
  border-bottom: 0.15rem solid currentColor;
  transform: translateY(-0.1rem) rotate(-45deg);
}

@media (prefers-reduced-motion: no-preference) {
  .round-feedback--motion {
    animation: show-feedback 140ms ease-out;
  }
}

@keyframes show-feedback {
  from {
    opacity: 0.75;
    transform: scale(0.96);
  }
}
</style>
