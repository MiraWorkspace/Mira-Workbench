<template>
  <div class="dialog-backdrop" @click.self="$emit('close')" @keydown.esc.stop="$emit('close')"><section class="site-dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="permissions-title">
    <div class="dialog-heading"><h2 id="permissions-title">{{ item.name }} · 权限</h2><button class="icon-button" type="button" aria-label="关闭权限设置" @click="$emit('close')"><X :size="17" /></button></div>
    <p class="manage-copy">版本 {{ item.manifest.version }}。修改权限会关闭正在运行的小程序。</p>
    <div class="permission-list"><label v-for="cap in item.manifest.requiredCapabilities" :key="cap"><input v-model="draft" type="checkbox" :value="cap" :disabled="busy" />{{ capabilityLabels[cap] }}</label><p v-if="!item.manifest.requiredCapabilities.length">此小程序未申请额外能力。</p></div>
    <div class="dialog-actions"><button class="add-button" type="button" :disabled="busy" @click="$emit('save', draft)">保存权限</button><button class="text-button" type="button" :disabled="busy" @click="$emit('revoke')">撤销全部权限</button></div>
    <h3 class="directory-heading">授权目录</h3><p class="manage-copy">仅可访问在此授权的目录，可分别授予只读或读写权限。</p>
    <div v-for="grant in item.directories" :key="grant.id" class="directory-item"><span>{{ grant.name }} · {{ grant.access === 'read' ? '只读' : '读写' }}</span><button class="text-button" type="button" :disabled="busy" @click="$emit('remove-directory', grant.id)">撤销目录授权</button></div>
    <div class="dialog-actions"><button class="cancel-button" type="button" :disabled="busy || !item.approved.includes('files:read')" @click="$emit('add-directory', 'read')">添加只读目录</button><button class="cancel-button" type="button" :disabled="busy || !item.approved.includes('files:read') || !item.approved.includes('files:write')" @click="$emit('add-directory', 'readwrite')">添加读写目录</button></div>
    <div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="$emit('close')">完成</button></div>
  </section></div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { capabilityLabels, type MiniappCapability } from '../miniapps/package'
import type { InstalledMiniapp } from '../miniapps/manager'

defineProps<{ item: InstalledMiniapp; busy: boolean }>()
defineEmits<{ close: []; save: [permissions: MiniappCapability[]]; revoke: []; 'remove-directory': [id: string]; 'add-directory': [access: 'read' | 'readwrite'] }>()
const draft = defineModel<MiniappCapability[]>('draft', { required: true })
</script>
