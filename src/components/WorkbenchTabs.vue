<template>
  <header class="topbar">
    <nav class="tabs" aria-label="工作区标签页">
      <button class="tab tab--home" :class="{ 'is-active': activeTab === 'home' }" type="button" @click="$emit('activate', 'home')"><img class="workbench-tab-logo" :src="logoUrl" alt="" /><span>工作台</span></button>
      <div ref="scrollingTabs" class="tabs-scroll">
        <button v-for="tab in browserTabs" :key="tab.id" class="tab tab--site" :class="{ 'is-active': activeTab === tab.id }" type="button" :title="tabLabel(tab)" @click="$emit('activate', tab.id)">
          <LoaderCircle v-if="tab.loading" class="tab-loading-indicator" :size="17" /><BrandMark v-else :brand="tab.brand" :name="tab.name" :url="tab.url" :favicon="tab.faviconUrl" :custom-icon="tab.iconUrl" :cached-icon="tab.cachedIcon" /><span>{{ tabLabel(tab) }}</span><span class="tab-close" role="button" tabindex="0" :aria-label="`关闭 ${tabLabel(tab)}`" @click.stop="$emit('close-site', tab.id)" @keydown.enter.stop="$emit('close-site', tab.id)"><X :size="13" /></span>
        </button>
        <button v-for="tab in miniappTabs" :key="tab.id" class="tab tab--site" :class="{ 'is-active': activeTab === tab.id }" type="button" @click="$emit('activate', tab.id)"><span>{{ tab.name }}</span><span class="tab-close" role="button" tabindex="0" :aria-label="`关闭 ${tab.name}`" @click.stop="$emit('close-miniapp', tab.id)" @keydown.enter.stop="$emit('close-miniapp', tab.id)"><X :size="13" /></span></button>
      </div>
    </nav>
    <div class="topbar-actions"><button class="icon-button" type="button" aria-label="新增" data-tooltip="新增" @click="$emit('add')"><Plus :size="17" /></button><button class="icon-button" type="button" aria-label="设置" data-tooltip="设置" @click="$emit('manage')"><SlidersHorizontal :size="17" /></button></div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { LoaderCircle, Plus, SlidersHorizontal, X } from 'lucide-vue-next'
import BrandMark from './BrandMark.vue'
import type { BrowserTab } from '../types'

const props = defineProps<{ activeTab: string; browserTabs: BrowserTab[]; miniappTabs: Array<{ id: string; name: string }>; logoUrl: string }>()
defineEmits<{ activate: [id: string]; 'close-site': [id: string]; 'close-miniapp': [id: string]; add: []; manage: [] }>()
const scrollingTabs = ref<HTMLElement>()
let resize: ResizeObserver | undefined
function tabLabel(tab: BrowserTab) {
  if (tab.pageTitle) return tab.pageTitle
  if (tab.loading) return '无标题'
  if (tab.name) return tab.name
  try { return new URL(tab.currentUrl).hostname } catch { return '无标题' }
}
function revealActiveTab() {
  const container = scrollingTabs.value, tab = container?.querySelector<HTMLElement>('.is-active')
  if (!container || !tab) return
  const viewport = container.getBoundingClientRect(), bounds = tab.getBoundingClientRect()
  if (bounds.left < viewport.left) container.scrollLeft += bounds.left - viewport.left
  else if (bounds.right > viewport.right) container.scrollLeft += bounds.right - viewport.right
}
watch([() => props.activeTab, () => props.browserTabs.map(tabLabel), () => props.miniappTabs.map(tab => tab.name)], revealActiveTab, { flush: 'post' })
onMounted(() => { resize = new ResizeObserver(revealActiveTab); if (scrollingTabs.value) resize.observe(scrollingTabs.value) })
onUnmounted(() => resize?.disconnect())
</script>
