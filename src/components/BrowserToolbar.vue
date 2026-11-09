<template>
  <div class="browser-toolbar">
    <div class="browser-controls">
      <button type="button" aria-label="后退" title="后退" :disabled="!canGoBack" @click="$emit('back')"><ArrowLeft :size="17" /></button>
      <button type="button" aria-label="前进" title="前进" :disabled="!canGoForward" @click="$emit('forward')"><ArrowRight :size="17" /></button>
      <button v-if="loading" type="button" aria-label="停止加载" title="停止加载" @click="$emit('stop')"><X :size="18" /></button>
      <button v-else type="button" aria-label="刷新页面" title="刷新页面" @click="$emit('reload')"><RotateCw :size="15" /></button>
    </div>
    <form class="address-bar" @submit.prevent="$emit('navigate')"><LockKeyhole :size="13" /><input ref="input" :value="address" aria-label="网站地址" inputmode="url" autocomplete="off" autocapitalize="off" :spellcheck="false" required @focus="$emit('editing', true)" @blur="$emit('editing', false)" @input="onInput" @keydown.esc.prevent="$emit('reset')" /></form>
    <button class="icon-button external-button" type="button" aria-label="在浏览器打开" data-tooltip="在浏览器打开" @click="$emit('external')"><ExternalLink :size="17" /></button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, ArrowRight, ExternalLink, LockKeyhole, RotateCw, X } from 'lucide-vue-next'

defineProps<{ address: string; loading: boolean; canGoBack: boolean; canGoForward: boolean }>()
const emit = defineEmits<{ 'update:address': [value: string]; editing: [value: boolean]; navigate: []; reset: []; back: []; forward: []; stop: []; reload: []; external: [] }>()
const input = ref<HTMLInputElement>()
function onInput(event: Event) { const target = event.target as HTMLInputElement; target.setCustomValidity(''); emit('update:address', target.value) }
function resetValidity() { input.value?.setCustomValidity('') }
function invalid(message: string) { input.value?.setCustomValidity(message); input.value?.reportValidity() }
function blur() { input.value?.blur() }
defineExpose({ resetValidity, invalid, blur })
</script>
