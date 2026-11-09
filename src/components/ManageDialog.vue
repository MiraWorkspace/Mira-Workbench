<template>
  <div class="dialog-backdrop dialog-backdrop--floating" @click.self="$emit('close')" @keydown.esc.stop="$emit('close')">
    <section class="manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-title">
      <div class="dialog-heading"><div><p class="eyebrow">COLLECTION SETTINGS</p><h2 id="manage-title">显示管理</h2></div><button class="icon-button" type="button" aria-label="关闭" @click="$emit('close')"><X :size="17" /></button></div>
      <p class="manage-copy">选择要显示的网站和小程序。</p>
      <div class="manage-list">
        <div v-for="site in sites" :key="site.id" class="manage-item"><BrandMark :brand="site.brand" :name="site.name" :url="site.url" :custom-icon="site.iconUrl" :cached-icon="site.cachedIcon" /><span>{{ site.name }}</span><button class="text-button manage-edit" type="button" :aria-label="`编辑 ${site.name}`" @click="$emit('edit', site)">编辑</button><input :checked="site.visible" type="checkbox" :aria-label="`显示 ${site.name}`" @change="$emit('site-visible', site, ($event.target as HTMLInputElement).checked)" /></div>
        <div v-for="item in miniapps" :key="item.id" class="manage-item"><span>{{ item.name.slice(0, 1) }}</span><span>{{ entry(item.id)?.name || item.name }}</span><button class="text-button manage-edit" type="button" @click="$emit('permissions', item)">权限</button><button v-if="item.reviewed" class="text-button" type="button" :disabled="busy" @click="$emit('revoke', item)">撤销权限</button><button class="text-button" type="button" :disabled="busy" @click="$emit('uninstall', item)">卸载</button><input type="checkbox" :aria-label="`显示 ${item.name}`" :checked="entry(item.id)?.visible !== false" @change="$emit('miniapp-visible', item.id, ($event.target as HTMLInputElement).checked)" /></div>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="dialog-actions"><button class="text-button" type="button" @click="$emit('restore')">恢复默认列表</button><span class="dialog-spacer"></span><button class="add-button" type="button" @click="$emit('done')"><Check :size="15" />完成</button></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'
import BrandMark from './BrandMark.vue'
import type { WebsiteEntry } from '../data/sites'
import type { WorkbenchEntry } from '../data/workbenchStore'
import type { InstalledMiniapp } from '../miniapps/manager'

const props = defineProps<{ sites: WebsiteEntry[]; miniapps: InstalledMiniapp[]; entries: WorkbenchEntry[]; busy: boolean; error: string }>()
defineEmits<{ close: []; edit: [site: WebsiteEntry]; 'site-visible': [site: WebsiteEntry, visible: boolean]; permissions: [item: InstalledMiniapp]; revoke: [item: InstalledMiniapp]; uninstall: [item: InstalledMiniapp]; 'miniapp-visible': [id: string, visible: boolean]; restore: []; done: [] }>()
function entry(id: string) { return props.entries.find(item => item.type === 'miniapp' && item.address === id) }
</script>
