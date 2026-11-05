<template>
  <span class="brand-mark" :class="{ 'brand-mark--fallback': !iconUrl || !imageLoaded }" aria-hidden="true">
    <span v-if="monochromeIcon" class="brand-mark__symbol" :style="{ maskImage: `url(${monochromeIcon})` }" />
    <img v-else-if="iconUrl && imageLoaded" :src="iconUrl" alt="" @error="imageLoaded = false" />
    <span v-else>{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ brand?: string; name: string; url: string; favicon?: string | null }>()
const assets = import.meta.glob<string>([
  '/node_modules/@lobehub/icons-static-svg/icons/{openai,gemini,deepseek,zhipu,kimi,qwen,doubao,minimax,claude,google,wenxin,yuanbao,spark,tiangong,huawei,grok}.svg',
  '/node_modules/@lobehub/icons-static-svg/icons/{openai,gemini,deepseek,zhipu,kimi,qwen,doubao,minimax,claude,google,wenxin,yuanbao,spark,tiangong,huawei,grok}-color.svg',
], { eager: true, query: '?url&no-inline', import: 'default' })
const symbols = new Map(Object.entries(assets).map(([path, url]) => [path.split('/').pop()!.replace(/\.svg$/, ''), url]))
const brandIcon = computed(() => {
  if (!props.brand) return undefined
  return symbols.get(`${props.brand}-color`) || symbols.get(props.brand)
})
const monochromeIcon = computed(() => props.brand && !symbols.has(`${props.brand}-color`) ? symbols.get(props.brand) : undefined)
const favicon = computed(() => {
  try { return `${new URL(props.url).origin}/favicon.ico` } catch { return undefined }
})
const iconUrl = computed(() => brandIcon.value || props.favicon || favicon.value)
const imageLoaded = ref(true)
const initial = computed(() => {
  const named = [...props.name.trim()][0]?.toUpperCase()
  if (named) return named
  try { return [...new URL(props.url).hostname.replace(/^www\./, '')][0]?.toUpperCase() || '?' } catch { return '?' }
})
watch(iconUrl, () => { imageLoaded.value = true })
</script>

<style scoped>
.brand-mark { display: grid; width: 40px; height: 40px; place-items: center; overflow: hidden; color: var(--brand-ink, #000); font-size: 25px; font-weight: 650; }
.brand-mark__symbol { width: 100%; height: 100%; background: currentColor; mask-repeat: no-repeat; mask-position: center; mask-size: contain; }
.brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; }
.brand-mark--fallback { border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 14px; background: color-mix(in srgb, currentColor 5%, transparent); }
</style>
