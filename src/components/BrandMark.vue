<template>
  <span class="brand-mark" :class="{ 'brand-mark--fallback': !imageLoaded }" aria-hidden="true">
    <img v-if="iconUrl && !failed" v-show="imageLoaded" :key="iconUrl" :src="iconUrl" alt="" @load="imageLoaded = true" @error="failed = true; imageLoaded = false" />
    <LayoutGrid v-if="!imageLoaded" class="brand-mark__default" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LayoutGrid } from 'lucide-vue-next'

const props = defineProps<{ brand?: string; name: string; url: string; favicon?: string | null; customIcon?: string; cachedIcon?: string }>()
const extensions: Record<string, string> = { chatgpt: 'png', claude: 'png', deepseek: 'svg', doubao: 'png', gemini: 'png', google: 'svg', grok: 'png', kimi: 'ico', minimax: 'png', nami: 'svg', qwen: 'png', tiangong: 'png', wenxin: 'ico', xiaoyi: 'png', xinghuo: 'ico', yuanbao: 'png', zhipu: 'png' }
const brandIcon = computed(() => props.brand && extensions[props.brand] ? `${import.meta.env.BASE_URL}favicons/${props.brand}.${extensions[props.brand]}` : undefined)
const failed = ref(false)
const iconUrl = computed(() => props.customIcon || props.cachedIcon || brandIcon.value || props.favicon)
const imageLoaded = ref(false)
watch(iconUrl, () => { failed.value = false; imageLoaded.value = false }, { flush: 'sync' })
</script>

<style scoped>
.brand-mark { display: grid; width: 40px; height: 40px; place-items: center; overflow: hidden; color: var(--brand-ink, #000); font-size: 25px; font-weight: 650; }
.brand-mark__default { width: 70%; height: 70%; }
.brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; }
.brand-mark--fallback { color: var(--site-icon-fallback, var(--accent, #476b5b)); }
</style>
