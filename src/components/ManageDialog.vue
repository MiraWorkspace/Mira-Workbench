<template>
  <div class="dialog-backdrop dialog-backdrop--floating" @click.self="$emit('close')" @keydown.esc.stop="$emit('close')">
    <section ref="dialog" class="manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-title" tabindex="-1" @keydown.tab="trapFocus">
      <div class="dialog-heading"><h2 id="manage-title">显示管理</h2><button class="icon-button" type="button" aria-label="关闭" @click="$emit('close')"><X :size="18" /></button></div>
      <div class="manage-body">
        <div class="manage-section-heading"><h3>网站和小程序</h3><div class="manage-tools"><button class="cancel-button" type="button" :disabled="busy || !items.length" @click="swapVisibility"><ArrowLeftRight :size="14" />交换</button><button class="cancel-button" type="button" :disabled="busy" @click="resetVisibility"><RotateCcw :size="14" />重置</button></div></div>
        <div class="manage-transfer">
          <section v-for="column in columns" :key="column.id" class="manage-column" :aria-labelledby="`manage-${column.id}`">
            <h4 :id="`manage-${column.id}`">{{ column.visible ? '显示的' : '隐藏的' }}网站 / 小程序 <span aria-live="polite">{{ column.items.length }}</span></h4>
            <ul v-if="column.items.length" class="manage-transfer-list">
              <li v-for="item in column.items" :key="`${item.type}:${item.id}`" class="manage-transfer-item">
                <BrandMark v-if="item.type === 'website'" :brand="item.site.brand" :name="item.name" :url="item.site.url" :custom-icon="item.site.iconUrl" :cached-icon="item.site.cachedIcon" />
                <BrandMark v-else :name="item.name" url="" :custom-icon="item.miniapp.icon" />
                <span class="manage-entry-name" :title="item.name">{{ item.name }}</span>
                <button v-if="item.type === 'website'" class="icon-button manage-entry-action" type="button" :aria-label="`编辑 ${item.name}`" @click="$emit('edit', item.site)"><Pencil :size="13" /></button>
                <details v-else class="manage-miniapp-menu"><summary class="icon-button" :aria-label="`管理 ${item.name}`"><MoreHorizontal :size="15" /></summary><div><button type="button" @click="$emit('permissions', item.miniapp)">权限设置</button><button v-if="item.miniapp.reviewed" type="button" :disabled="busy" @click="$emit('revoke', item.miniapp)">撤销权限</button><button type="button" :disabled="busy" @click="$emit('uninstall', item.miniapp)">卸载</button></div></details>
                <button class="icon-button manage-move" type="button" :disabled="busy" :data-entry-key="`${item.type}:${item.id}`" :aria-label="`${column.visible ? '隐藏' : '显示'} ${item.name}`" @click="setVisible(item, !column.visible, $event)"><ArrowRightToLine v-if="column.visible" :size="17" /><ArrowLeftToLine v-else :size="17" /></button>
              </li>
            </ul>
            <p v-else class="manage-transfer-empty">{{ column.visible ? '在右侧点击显示图标，添加到工作台' : '在左侧点击隐藏图标，移到这里' }}</p>
          </section>
        </div>
        <section class="manage-preferences" aria-labelledby="preferences-title">
          <h3 id="preferences-title">使用偏好</h3>
          <div class="manage-preference"><div><label id="external-label" for="external-switch">在默认浏览器中打开新窗口链接</label><p id="external-description">开启后，网页中的新窗口链接使用系统默认浏览器打开</p></div><button id="external-switch" class="preference-switch" type="button" role="switch" :aria-checked="preferences.openNewWindowInBrowser" aria-labelledby="external-label" aria-describedby="external-description" @click="updatePreferences({ openNewWindowInBrowser: !preferences.openNewWindowInBrowser })"><span /></button></div>
          <div class="manage-preference"><div><label for="tab-cache-count">标签缓存数量</label><p id="cache-description">保留最近使用的后台页面，超出后释放，再次切换时重新加载。0 表示不保留后台页面。</p></div><select id="tab-cache-count" :value="preferences.tabCacheCount" aria-describedby="cache-description" @change="updatePreferences({ tabCacheCount: Number(($event.target as HTMLSelectElement).value) })"><option v-for="count in 11" :key="count - 1" :value="count - 1">{{ count - 1 }} 个</option></select></div>
        </section>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      </div>
      <div class="dialog-actions"><button class="text-button" type="button" :disabled="busy" @click="$emit('restore')">恢复默认列表</button><span class="dialog-spacer"></span><button class="add-button" type="button" @click="$emit('done')"><Check :size="15" />完成</button></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeftRight, ArrowLeftToLine, ArrowRightToLine, Check, MoreHorizontal, Pencil, RotateCcw, X } from 'lucide-vue-next'
import BrandMark from './BrandMark.vue'
import type { WebsiteEntry } from '../data/sites'
import type { WorkbenchEntry } from '../data/workbenchStore'
import type { WorkbenchPreferences } from '../data/preferences'
import type { InstalledMiniapp } from '../miniapps/manager'

type ManageItem = { type: 'website'; id: string; name: string; visible: boolean; site: WebsiteEntry } | { type: 'miniapp'; id: string; name: string; visible: boolean; miniapp: InstalledMiniapp }
const props = defineProps<{ sites: WebsiteEntry[]; miniapps: InstalledMiniapp[]; entries: WorkbenchEntry[]; preferences: WorkbenchPreferences; busy: boolean; error: string }>()
const emit = defineEmits<{ close: []; edit: [site: WebsiteEntry]; 'site-visible': [site: WebsiteEntry, visible: boolean]; permissions: [item: InstalledMiniapp]; revoke: [item: InstalledMiniapp]; uninstall: [item: InstalledMiniapp]; 'miniapp-visible': [id: string, visible: boolean]; preferences: [value: WorkbenchPreferences]; restore: []; done: [] }>()
const items = computed<ManageItem[]>(() => [
  ...props.sites.map(site => ({ type: 'website' as const, id: site.id, name: site.name, visible: site.visible, site })),
  ...props.miniapps.map(miniapp => { const entry = props.entries.find(item => item.type === 'miniapp' && item.address === miniapp.id); return { type: 'miniapp' as const, id: miniapp.id, name: entry?.name || miniapp.name, visible: entry?.visible !== false, miniapp } }),
])
const columns = computed(() => [true, false].map(visible => ({ id: visible ? 'shown' : 'hidden', visible, items: items.value.filter(item => item.visible === visible) })))
function setVisible(item: ManageItem, visible: boolean, event?: Event) {
  const restoreFocus = event?.currentTarget === document.activeElement
  if (item.type === 'website') emit('site-visible', item.site, visible); else emit('miniapp-visible', item.id, visible)
  if (restoreFocus) void nextTick(() => [...dialog.value!.querySelectorAll<HTMLButtonElement>('.manage-move')].find(button => button.dataset.entryKey === `${item.type}:${item.id}`)?.focus())
}
function swapVisibility() { for (const item of items.value) setVisible(item, !item.visible) }
function resetVisibility() { for (const item of items.value) if (!item.visible) setVisible(item, true) }
function updatePreferences(value: Partial<WorkbenchPreferences>) { emit('preferences', { ...props.preferences, ...value }) }
const dialog = ref<HTMLElement>()
let previousFocus: HTMLElement | null = null
onMounted(() => { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; dialog.value?.focus() })
onUnmounted(() => previousFocus?.focus())
function trapFocus(event: KeyboardEvent) {
  const controls = [...dialog.value!.querySelectorAll<HTMLElement>('button:not(:disabled), select, summary')].filter(element => element.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.value)) { event.preventDefault(); first?.focus() }
}
</script>
