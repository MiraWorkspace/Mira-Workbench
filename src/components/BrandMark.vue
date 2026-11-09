<template>
  <span class="brand-mark" :class="{ 'brand-mark--fallback': !imageLoaded }" aria-hidden="true">
    <img v-if="iconUrl" :src="iconUrl" alt="" @error="nextIcon" />
    <span v-else>{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ brand?: string; name: string; url: string; favicon?: string | null; customIcon?: string }>()
const extensions: Record<string, string> = { chatgpt: 'png', claude: 'png', deepseek: 'svg', doubao: 'png', gemini: 'png', google: 'svg', grok: 'png', kimi: 'ico', minimax: 'png', nami: 'svg', qwen: 'png', tiangong: 'png', wenxin: 'ico', xiaoyi: 'png', xinghuo: 'ico', yuanbao: 'png', zhipu: 'png' }
const brandIcon = computed(() => props.brand && extensions[props.brand] ? `${import.meta.env.BASE_URL}favicons/${props.brand}.${extensions[props.brand]}` : undefined)
const favicon = computed(() => {
  try { return `${new URL(props.url).origin}/favicon.ico` } catch { return undefined }
})
const failed = ref(false)
const customFailed = ref(false)
const brandFailed = ref(false)
const iconUrl = computed(() => !customFailed.value && props.customIcon ? props.customIcon : !brandFailed.value && brandIcon.value ? brandIcon.value : !failed.value ? props.favicon || favicon.value : undefined)
const imageLoaded = computed(() => Boolean(iconUrl.value))
const initial = computed(() => {
  const named = [...props.name.trim()][0]?.toUpperCase()
  if (named) return named
  try { return [...new URL(props.url).hostname.replace(/^www\./, '')][0]?.toUpperCase() || '?' } catch { return '?' }
})
function nextIcon() { if (!customFailed.value && props.customIcon) customFailed.value = true; else if (!brandFailed.value && brandIcon.value) brandFailed.value = true; else failed.value = true }
watch(() => [props.url, props.favicon, props.brand, props.customIcon], () => { failed.value = false; customFailed.value = false; brandFailed.value = false })
</script>

<style scoped>
.brand-mark { display: grid; width: 40px; height: 40px; place-items: center; overflow: hidden; color: var(--brand-ink, #000); font-size: 25px; font-weight: 650; }
.brand-mark__symbol { width: 100%; height: 100%; background: currentColor; mask-repeat: no-repeat; mask-position: center; mask-size: contain; }
.brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; }
.brand-mark--fallback { border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 14px; background: color-mix(in srgb, currentColor 5%, transparent); }
</style>
