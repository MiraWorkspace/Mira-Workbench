<template>
  <div class="dialog-backdrop delete-site-backdrop" @keydown.esc.stop="$emit('cancel')">
    <section class="site-dialog delete-site-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-site-title" aria-describedby="delete-site-description" @keydown.tab="trapFocus">
      <h2 id="delete-site-title">删除自定义网站？</h2>
      <p id="delete-site-description">确定要删除自定义网站「{{ site.name }}」吗？此操作无法撤销。</p>
      <div class="dialog-actions"><span class="dialog-spacer" /><button ref="cancelButton" class="cancel-button" type="button" @click="$emit('cancel')">取消</button><button ref="deleteButton" class="delete-site-confirm" type="button" @click="$emit('confirm')">删除</button></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { WebsiteEntry } from '../data/sites'

defineProps<{ site: WebsiteEntry }>()
defineEmits<{ cancel: []; confirm: [] }>()
const cancelButton = ref<HTMLButtonElement>(), deleteButton = ref<HTMLButtonElement>()
let previousFocus: HTMLElement | null = null
onMounted(() => { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; cancelButton.value?.focus() })
onUnmounted(() => {
  if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus()
  else document.querySelector<HTMLInputElement>('[aria-label="搜索网站"]')?.focus()
})
function trapFocus(event: KeyboardEvent) {
  if (event.shiftKey && document.activeElement === cancelButton.value) { event.preventDefault(); deleteButton.value?.focus() }
  else if (!event.shiftKey && document.activeElement === deleteButton.value) { event.preventDefault(); cancelButton.value?.focus() }
}
</script>

<style scoped>
.delete-site-backdrop { z-index: 6; }
.delete-site-dialog { width: min(520px, 100%); }
.delete-site-dialog h2 { margin: 0 0 12px; font-size: 19px; font-weight: 600; }
.delete-site-dialog p { margin: 0; color: var(--text); font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.delete-site-dialog .dialog-actions { margin-top: 24px; }
.delete-site-confirm { min-height: 34px; padding: 0 12px; border: 0; border-radius: 6px; background: #d92d3a; color: #fff; font-size: 11px; cursor: pointer; }
.delete-site-confirm:hover { background: #be2430; }
</style>
