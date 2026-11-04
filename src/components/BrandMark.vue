<template>
  <span class="brand-mark" :class="{ 'brand-mark--fallback': !iconUrl && !imageLoaded }" aria-hidden="true">
    <img v-if="iconUrl && imageLoaded" :src="iconUrl" alt="" @error="imageLoaded = false" />
    <span v-else>{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ brand?: string; name: string; url: string }>()
const assets = import.meta.glob<string>([
  '/node_modules/@lobehub/icons-static-svg/icons/{openai,gemini,deepseek,zhipu,kimi,qwen,doubao,minimax,claude,google,wenxin,yuanbao,spark,tiangong,huawei,grok}.svg',
  '/node_modules/@lobehub/icons-static-svg/icons/{openai,gemini,deepseek,zhipu,kimi,qwen,doubao,minimax,claude,google,wenxin,yuanbao,spark,tiangong,huawei,grok}-color.svg',
], { eager: true, query: '?url&no-inline', import: 'default' })
const symbols = new Map(Object.entries(assets).map(([path, url]) => [path.split('/').pop()!.replace(/\.svg$/, ''), url]))
const brandIcon = computed(() => {
  if (!props.brand) return undefined
  return symbols.get(`${props.brand}-color`) || symbols.get(props.brand)
})
const favicon = computed(() => {
  try { return `${new URL(props.url).origin}/favicon.ico` } catch { return undefined }
})
const iconUrl = computed(() => brandIcon.value || favicon.value)
const imageLoaded = ref(true)
const initial = computed(() => [...props.name.trim()][0]?.toUpperCase() || '?')
watch(iconUrl, () => { imageLoaded.value = true })
</script>

<style scoped>
.brand-mark { display: grid; width: 52px; height: 52px; place-items: center; overflow: hidden; color: #303944; font-size: 25px; font-weight: 650; }
.brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; }
.brand-mark--fallback { border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 14px; background: color-mix(in srgb, currentColor 5%, transparent); }
</style>
