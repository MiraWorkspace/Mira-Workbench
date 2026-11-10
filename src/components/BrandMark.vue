<template>
  <span class="brand-mark" :class="{ 'brand-mark--fallback': !imageLoaded }" aria-hidden="true">
    <img v-if="iconUrl && !failed" v-show="imageLoaded" :key="iconUrl" :src="iconUrl" alt="" @load="imageLoaded = true" @error="failed = true; imageLoaded = false" />
    <LayoutGrid v-if="!imageLoaded" class="brand-mark__default" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LayoutGrid } from 'lucide-vue-next'
import { siteIconUrl } from '../siteIcon'

const props = defineProps<{ brand?: string; name: string; url: string; favicon?: string | null; customIcon?: string; cachedIcon?: string }>()
const failed = ref(false)
const iconUrl = computed(() => siteIconUrl(props))
const imageLoaded = ref(false)
watch(iconUrl, () => { failed.value = false; imageLoaded.value = false }, { flush: 'sync' })
</script>

<style scoped>
.brand-mark { display: grid; width: 40px; height: 40px; place-items: center; overflow: hidden; color: var(--brand-ink, #000); font-size: 25px; font-weight: 650; }
.brand-mark__default { width: 70%; height: 70%; }
.brand-mark img { display: block; width: 100%; height: 100%; object-fit: contain; }
.brand-mark--fallback { color: var(--site-icon-fallback, var(--accent, #476b5b)); }
</style>
