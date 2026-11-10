<template>
  <header class="topbar">
    <nav class="tabs" aria-label="工作区标签页">
      <button class="tab tab--home" :class="{ 'is-active': activeTab === 'home' }" type="button" @click="$emit('activate', 'home')"><img class="workbench-tab-logo" :src="logoUrl" alt="" /><span>工作台</span></button>
      <div ref="scrollingTabs" class="tabs-scroll" :class="{ 'tabs--dragging': draggingId }" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag">
       <TransitionGroup name="tab" tag="div" class="tabs-list">
        <button v-for="tab in tabs" :key="tab.id" class="tab tab--site" :class="{ 'is-active': activeTab === tab.id, 'is-pinned': tab.pinned, 'is-dragging': draggingId === tab.id, 'is-returning': tab.returning }" type="button" :data-tooltip="draggingId ? undefined : tab.name" :data-tab-id="tab.id" :style="draggingId === tab.id ? { translate: `${dragOffset}px 0` } : undefined" @click="activateTab(tab.id, $event)" @contextmenu.prevent.stop="openContextMenu($event, tab.id)" @pointerdown="startDrag(tab.id, $event)" @dragstart.prevent>
          <LoaderCircle v-if="tab.kind === 'website' && tab.loading" class="tab-loading-indicator" :size="17" /><BrandMark v-else-if="tab.kind === 'website'" :brand="tab.brand" :name="tab.name" :url="tab.url || ''" :favicon="tab.favicon" :custom-icon="tab.customIcon" :cached-icon="tab.cachedIcon" /><span v-else class="miniapp-tab-icon"><img v-if="tab.icon" :src="tab.icon" alt="" /><Package v-else :size="16" /></span>
          <Pin v-if="tab.pinned" class="tab-pin" :size="11" aria-label="已固定" /><span class="tab-label">{{ tab.name }}</span><VolumeX v-if="tab.muted" class="tab-muted" :size="13" aria-label="已静音" /><span class="tab-close" role="button" tabindex="0" :aria-label="`关闭 ${tab.name}`" @click.stop="$emit('close', tab.id)" @pointerdown.stop @keydown.enter.stop.prevent="$emit('close', tab.id)" @keydown.space.stop.prevent="$emit('close', tab.id)"><X :size="13" /></span>
        </button>
       </TransitionGroup>
      </div>
    </nav>
    <div class="topbar-actions"><button class="icon-button" type="button" aria-label="添加" data-tooltip="添加" @click="$emit('add')"><Plus :size="17" /></button><button class="icon-button" type="button" aria-label="设置" @click="$emit('manage')"><Menu :size="21" /></button></div>
    <FloatingTransition><div v-if="contextMenu" ref="contextMenuElement" class="tab-context-menu" role="menu" tabindex="-1" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @contextmenu.prevent @keydown="navigateMenu">
      <button type="button" role="menuitem" @click="runAction('reload')"><RefreshCw :size="14" />重新加载</button>
      <button type="button" role="menuitem" @click="runAction('duplicate')"><Copy :size="14" />复制</button>
      <button type="button" role="menuitem" @click="runAction('pin')"><Pin v-if="!contextTab?.pinned" :size="14" /><PinOff v-else :size="14" />{{ contextTab?.pinned ? '取消固定' : '固定' }}</button>
      <button type="button" role="menuitem" @click="runAction('mute')"><Volume2 v-if="!contextTab?.muted" :size="14" /><VolumeX v-else :size="14" />{{ contextTab?.muted ? '将这个网站取消静音' : '将网站静音' }}</button>
      <div class="tab-context-separator" role="separator" />
      <button type="button" role="menuitem" @click="runAction('close')"><X :size="14" />关闭</button>
      <button type="button" role="menuitem" @click="runAction('close-others')"><PanelsTopLeft :size="14" />关闭其他</button>
      <button type="button" role="menuitem" @click="runAction('close-right')"><ArrowRightToLine :size="14" />关闭右侧</button>
    </div></FloatingTransition>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowRightToLine, Copy, LoaderCircle, Menu, Package, PanelsTopLeft, Pin, PinOff, Plus, RefreshCw, Volume2, VolumeX, X } from 'lucide-vue-next'
import BrandMark from './BrandMark.vue'
import FloatingTransition from './FloatingTransition.vue'
import type { WorkbenchTabView } from '../types'

const props = defineProps<{ activeTab: string; tabs: WorkbenchTabView[]; logoUrl: string }>()
const emit = defineEmits<{ activate: [id: string]; close: [id: string]; reorder: [ids: string[]]; action: [action: 'reload' | 'duplicate' | 'pin' | 'mute' | 'close' | 'close-others' | 'close-right', id: string]; detach: [id: string, grabX: number]; detachedDragEnd: [id: string]; menu: [open: boolean]; add: []; manage: [] }>()
const scrollingTabs = ref<HTMLElement>(), contextMenuElement = ref<HTMLElement>(), contextMenu = ref<{ id: string; x: number; y: number }>(), draggingId = ref('')
const dragOffset = ref(0)
let gesture: { id: string; pointerId: number; x: number; y: number; grabX: number; detached: boolean } | undefined
let suppressClick = false
let resizeObserver: ResizeObserver | undefined
let menuTrigger: HTMLElement | undefined
const contextTab = computed(() => props.tabs.find(tab => tab.id === contextMenu.value?.id))

function revealActiveTab() {
  const container = scrollingTabs.value, tab = container?.querySelector<HTMLElement>('.is-active')
  if (!container || !tab || gesture) return
  const viewport = container.getBoundingClientRect(), bounds = tab.getBoundingClientRect()
  if (bounds.left < viewport.left) container.scrollLeft += bounds.left - viewport.left
  else if (bounds.right > viewport.right) container.scrollLeft += bounds.right - viewport.right
}
function openContextMenu(event: MouseEvent, id: string) {
  const width = 190, height = 300
  menuTrigger = event.currentTarget as HTMLElement
  contextMenu.value = { id, x: Math.max(6, Math.min(event.clientX, window.innerWidth - width - 6)), y: Math.max(6, Math.min(event.clientY, window.innerHeight - height - 6)) }; emit('menu', true); void nextTick(() => {
    const menu = contextMenuElement.value, position = contextMenu.value
    if (!menu || !position) return
    position.x = Math.max(6, Math.min(position.x, window.innerWidth - menu.offsetWidth - 6))
    position.y = Math.max(6, Math.min(position.y, window.innerHeight - menu.offsetHeight - 6))
    menu.querySelector<HTMLButtonElement>('button')?.focus()
  })
}
function hideContextMenu() { if (!contextMenu.value) return; contextMenu.value = undefined; emit('menu', false) }
function runAction(action: 'reload' | 'duplicate' | 'pin' | 'mute' | 'close' | 'close-others' | 'close-right') {
  const id = contextMenu.value?.id
  hideContextMenu()
  if (id) emit('action', action, id)
}
function activateTab(id: string, event: MouseEvent) {
  if (suppressClick) { event.preventDefault(); return }
  emit('activate', id)
}
function startDrag(id: string, event: PointerEvent) {
  if (event.button !== 0 || gesture) return
  const source = event.currentTarget as HTMLElement
  gesture = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, grabX: event.clientX - source.getBoundingClientRect().left, detached: false }
  scrollingTabs.value?.setPointerCapture(event.pointerId)
  hideContextMenu()
}
function moveDrag(event: PointerEvent) {
  const drag = gesture, container = scrollingTabs.value
  if (!drag || !container || event.pointerId !== drag.pointerId || drag.detached) return
  if (!draggingId.value && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return
  draggingId.value = drag.id; suppressClick = true
  // Leaving the strip, rather than diagonal speed, changes the same held gesture into a window drag.
  const viewport = container.getBoundingClientRect()
  if (event.clientY < viewport.top - 40 || event.clientY > viewport.bottom + 40) {
    drag.detached = true; dragOffset.value = 0
    emit('detach', drag.id, drag.grabX)
    return
  }
  if (event.clientX < viewport.left + 32) container.scrollLeft -= 14
  else if (event.clientX > viewport.right - 32) container.scrollLeft += 14
  const source = props.tabs.find(tab => tab.id === drag.id)
  const elements = [...container.querySelectorAll<HTMLElement>('.tab--site:not(.tab-leave-active)')]
  const element = elements.find(tab => tab.dataset.tabId === drag.id)
  if (!element || !source) return
  const left = viewport.left - container.scrollLeft
  const ids = props.tabs.map(tab => tab.id), from = ids.indexOf(drag.id)
  const center = event.clientX - drag.grabX + element.offsetWidth / 2
  const peers = elements.filter(tab => props.tabs.find(item => item.id === tab.dataset.tabId)?.pinned === source.pinned)
  // offsetLeft excludes FLIP transforms, so moving neighbours never feed back into hit testing.
  const target = peers.filter(tab => tab !== element && center > left + tab.offsetLeft + tab.offsetWidth / 2).length
  const to = props.tabs.findIndex(tab => tab.id === peers[0]?.dataset.tabId) + target
  dragOffset.value = event.clientX - drag.grabX - left - element.offsetLeft
  if (to >= 0 && to !== from) {
    ids.splice(from, 1); ids.splice(to, 0, drag.id); emit('reorder', ids)
    void nextTick(() => { if (gesture === drag && !drag.detached) dragOffset.value = event.clientX - drag.grabX - left - element.offsetLeft })
  }
}
function endDrag(event?: PointerEvent) {
  const drag = gesture
  if (!drag || (event && event.pointerId !== drag.pointerId)) return
  if (!draggingId.value && event?.type === 'pointerup') emit('activate', drag.id)
  gesture = undefined; draggingId.value = ''; dragOffset.value = 0
  const container = scrollingTabs.value
  if (container?.hasPointerCapture(drag.pointerId)) container.releasePointerCapture(drag.pointerId)
  if (drag.detached) emit('detachedDragEnd', drag.id)
  window.setTimeout(() => { suppressClick = false }, 0)
}
function navigateMenu(event: KeyboardEvent) {
  const buttons = [...(contextMenuElement.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus() }
  else if (event.key === 'Home') { event.preventDefault(); buttons[0]?.focus() }
  else if (event.key === 'End') { event.preventDefault(); buttons.at(-1)?.focus() }
}
function onDocumentPointerDown(event: PointerEvent) { if (!(event.target as Element | null)?.closest('.tab-context-menu')) hideContextMenu() }
function onDocumentKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') { endDrag(); if (contextMenu.value) { hideContextMenu(); menuTrigger?.focus() } } }
watch([() => props.activeTab, () => props.tabs.map(tab => `${tab.id}:${tab.name}:${tab.loading}`)], revealActiveTab, { flush: 'post' })
onMounted(() => { document.addEventListener('pointerdown', onDocumentPointerDown); document.addEventListener('keydown', onDocumentKeyDown); resizeObserver = new ResizeObserver(revealActiveTab); if (scrollingTabs.value) resizeObserver.observe(scrollingTabs.value); revealActiveTab() })
onUnmounted(() => { endDrag(); resizeObserver?.disconnect(); document.removeEventListener('pointerdown', onDocumentPointerDown); document.removeEventListener('keydown', onDocumentKeyDown) })
</script>
