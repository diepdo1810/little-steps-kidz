<script setup lang="ts">
defineEmits<{ settings: [] }>()
</script>

<template>
  <section class="session-end" aria-label="Đã kết thúc phiên">
    <button class="icon-button end-settings" aria-label="Cài đặt người lớn" @click="$emit('settings')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>
    </button>
    <div class="end-symbol">
      <svg viewBox="0 0 160 160" role="img" aria-label="Nghỉ ngơi và chăm cây">
        <circle cx="80" cy="80" r="78" fill="#e8efe2"/>
        <circle cx="112" cy="46" r="14" fill="#ebc47a"/>
        <g stroke="#48735d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M79 106V74" fill="none"/>
          <path d="M79 88C62 89 48 77 46 59c19-1 34 9 33 29Z" fill="#95b79a"/>
          <path d="M80 78c-1-17 9-28 26-33 2 17-9 31-26 33Z" fill="#c1cf9e"/>
          <path d="m56 98 7 28h32l7-28Z" fill="#dbab8c"/>
          <rect x="52" y="94" width="54" height="8" rx="3" fill="#eac4a2"/>
        </g>
        <circle cx="123" cy="122" r="16" fill="#426b53"/><path d="m115 122 5 5 11-12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>
  </section>
</template>
