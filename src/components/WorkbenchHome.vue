<template>
  <section class="home-view">
    <WorkbenchActions class="home-actions" @add="$emit('add')" @manage="$emit('manage')" />
    <div class="home-content">
      <div class="search-row"><label class="search-box"><Search :size="18" /><input v-model="query" aria-label="搜索网站" placeholder="搜索" /><button v-if="query" type="button" aria-label="清除搜索" @click="query = ''"><X :size="15" /></button></label></div>
      <div v-if="filteredEntries.length" class="site-grid">
        <button v-for="entry in filteredEntries" :key="`${entry.type}:${entry.item.id}`" class="site-card" type="button" :aria-disabled="entry.type === 'miniapp' && (!entry.item.enabled || openingMiniapp)" @click="open(entry)" @contextmenu.prevent="openMenu($event, entry)">
          <span class="site-icon"><BrandMark v-if="entry.type === 'website'" :brand="entry.item.brand" :name="entry.item.name" :url="entry.item.url" :custom-icon="entry.item.iconUrl" :cached-icon="entry.item.cachedIcon" /><template v-else><img v-if="entry.item.icon" :src="entry.item.icon" alt="" width="40" height="40" @error="entry.item.icon = undefined" /><span v-else>{{ entry.name.slice(0, 1) }}</span></template><span v-if="entry.opened" class="site-open-indicator" aria-hidden="true" /></span>
          <span class="site-card__name"><Pin v-if="entry.pinned" :size="12" aria-label="已置顶" /><span>{{ entry.name }}</span></span>
        </button>
      </div>
      <FloatingTransition><div v-if="menu" class="entry-menu" role="menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @keydown.esc.stop="closeMenu" @contextmenu.prevent>
        <button type="button" role="menuitem" @click="action('hide')">隐藏</button>
        <button type="button" role="menuitem" @click="action('pin')">{{ menu.entry.pinned ? '取消置顶' : '置顶' }}</button>
        <template v-if="!menu.entry.builtin"><button type="button" role="menuitem" @click="action('edit')">编辑</button><button class="entry-menu__delete" type="button" role="menuitem" @click="action('delete')">删除</button></template>
      </div></FloatingTransition>
      <div v-if="!filteredEntries.length" class="empty-state"><span><Search :size="22" /></span><strong>没有找到匹配的网站或小程序</strong><p>试试其他名称，或添加你自己的网址。</p><button type="button" @click="$emit('add')"><Plus :size="15" />添加网站</button></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Pin, Plus, Search, X } from 'lucide-vue-next'
import BrandMark from './BrandMark.vue'
import WorkbenchActions from './WorkbenchActions.vue'
import FloatingTransition from './FloatingTransition.vue'
import type { GridEntry } from '../types'

const props = defineProps<{ entries: GridEntry[]; openingMiniapp: boolean }>()
const emit = defineEmits<{ open: [entry: GridEntry]; hide: [entry: GridEntry]; pin: [entry: GridEntry]; edit: [entry: GridEntry]; delete: [entry: GridEntry]; add: []; manage: [] }>()
const query = defineModel<string>('query', { default: '' })
const menu = ref<{ entry: GridEntry; x: number; y: number }>()
const filteredEntries = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return props.entries.filter(entry => `${entry.name} ${entry.type === 'website' ? entry.item.url : entry.item.id}`.toLocaleLowerCase().includes(term)).sort((a, b) => Number(b.pinned) - Number(a.pinned))
})
function open(entry: GridEntry) { if (entry.type === 'website' || (entry.item.enabled && !props.openingMiniapp)) emit('open', entry) }
function openMenu(event: MouseEvent, entry: GridEntry) {
  menu.value = { entry, x: Math.max(0, Math.min(event.clientX, window.innerWidth - 150)), y: Math.max(0, Math.min(event.clientY, window.innerHeight - (entry.builtin ? 80 : 152))) }
  void nextTick(() => document.querySelector<HTMLButtonElement>('.entry-menu button')?.focus())
}
function closeMenu() { menu.value = undefined }
function dismissMenu(event: MouseEvent) { if (!(event.target as Element).closest('.entry-menu')) closeMenu() }
function action(type: 'hide' | 'pin' | 'edit' | 'delete') { const entry = menu.value?.entry; closeMenu(); if (!entry) return; if (type === 'hide') emit('hide', entry); else if (type === 'pin') emit('pin', entry); else if (type === 'edit') emit('edit', entry); else emit('delete', entry) }
onMounted(() => { window.addEventListener('click', dismissMenu); window.addEventListener('scroll', closeMenu, true) })
onUnmounted(() => { window.removeEventListener('click', dismissMenu); window.removeEventListener('scroll', closeMenu, true) })
</script>
