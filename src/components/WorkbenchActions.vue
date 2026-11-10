<template>
  <div class="topbar-actions"><button class="icon-button" type="button" aria-label="添加" data-tooltip="添加" @click="$emit('add')"><Plus :size="16" :stroke-width="1.5" absolute-stroke-width /></button><button class="icon-button" type="button" aria-label="设置" @click="$emit('manage')"><Menu :size="14" :stroke-width="1.5" absolute-stroke-width /></button></div>
</template>

<script setup lang="ts">
import { Menu, Plus } from 'lucide-vue-next'

defineEmits<{ add: []; manage: [] }>()
</script>
