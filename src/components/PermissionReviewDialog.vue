<template>
  <div class="dialog-backdrop review-backdrop" @keydown.esc.stop="$emit('finish', false)">
    <section ref="dialog" class="site-dialog review-dialog" role="alertdialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-permission-hint" tabindex="-1" @keydown.tab="trapFocus">
      <header class="dialog-heading review-heading">
        <h2 id="review-title">{{ review.title }}</h2>
        <button class="icon-button" type="button" aria-label="关闭权限确认" @click="$emit('finish', false)"><X :size="18" /></button>
      </header>
      <div class="review-body">
        <div class="review-summary">
          <div class="review-app">
            <div class="review-app-icon" aria-hidden="true"><img v-if="review.icon && !iconFailed" :src="review.icon" alt="" @error="iconFailed = true" /><Package v-else :size="30" /></div>
            <div class="review-app-info">
              <h3>{{ review.manifest.name }}</h3>
              <p class="review-version">版本 {{ review.manifest.version }}<span v-if="review.currentVersion"> · 当前 {{ review.currentVersion }}</span></p>
              <p class="review-app-id">{{ review.manifest.id }}</p>
            </div>
          </div>
          <div v-if="review.manifest.description" class="review-description-wrap" @mouseenter="showDescription" @mouseleave="descriptionExpanded = false">
            <p ref="description" class="review-description" tabindex="0" :aria-describedby="descriptionExpanded ? 'review-description-full' : undefined" @focus="showDescription" @blur="descriptionExpanded = false">{{ review.manifest.description }}</p>
            <div v-if="descriptionExpanded" id="review-description-full" class="review-description-full" role="tooltip">{{ review.manifest.description }}</div>
          </div>
          <div v-if="review.source" class="review-source"><span>安装来源</span><p>{{ review.source }}</p></div>
        </div>
        <section class="review-permissions" aria-labelledby="review-permissions-title">
          <h3 id="review-permissions-title">申请权限<span>{{ review.permissions.length }} 项</span></h3>
          <p id="review-permission-hint" class="review-hint">{{ review.permissions.length ? '确认后将授予以下能力，可在设置中调整或撤销。' : '此小程序未申请额外能力。' }}</p>
          <div class="review-permission-content" tabindex="0" aria-label="申请权限列表">
            <div v-for="group in groups" :key="group.title" class="review-permission-group">
              <component :is="group.icon" :size="18" aria-hidden="true" />
              <div><h4>{{ group.title }}</h4><ul><li v-for="permission in group.permissions" :key="permission">{{ capabilityLabels[permission] }}</li></ul><p v-if="group.hint" class="review-hint">{{ group.hint }}</p></div>
            </div>
          </div>
        </section>
      </div>
      <footer class="dialog-actions review-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="$emit('finish', false)">取消</button><button class="add-button" type="button" @click="$emit('finish', true)">{{ review.confirm }}</button></footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bell, Database, FolderOpen, Package, Sparkles, X } from 'lucide-vue-next'
import { capabilityLabels, type MiniappCapability } from '../miniapps/package'
import type { ReviewRequest } from '../miniapps/manager'

const props = defineProps<{ review: ReviewRequest }>()
defineEmits<{ finish: [approved: boolean] }>()
const dialog = ref<HTMLElement>(), description = ref<HTMLElement>(), iconFailed = ref(false), descriptionExpanded = ref(false)
function showDescription() {
  descriptionExpanded.value = Boolean(description.value && description.value.scrollHeight > description.value.clientHeight + 1)
}
const groups = computed(() => [
  { title: 'AI 与联网', icon: Sparkles, capabilities: ['models:generate', 'web:search'], hint: '' },
  { title: '文件访问', icon: FolderOpen, capabilities: ['files:read', 'files:write'], hint: '包含此小程序的私有文件；访问外部目录需你另行选择并授权。' },
  { title: '独立数据', icon: Database, capabilities: ['storage:app'], hint: '' },
  { title: '外观与通知', icon: Bell, capabilities: ['appearance:read', 'notifications:send'], hint: '' },
].map(group => ({ ...group, permissions: group.capabilities.filter((cap): cap is MiniappCapability => props.review.permissions.includes(cap as MiniappCapability)) })).filter(group => group.permissions.length))
function trapFocus(event: KeyboardEvent) {
  const targets = dialog.value?.querySelectorAll<HTMLElement>('button, [tabindex="0"]')
  if (!targets?.length) return
  if (event.shiftKey && (document.activeElement === targets[0] || document.activeElement === dialog.value)) { event.preventDefault(); targets[targets.length - 1]?.focus() }
  else if (!event.shiftKey && document.activeElement === targets[targets.length - 1]) { event.preventDefault(); targets[0]?.focus() }
}
onMounted(() => dialog.value?.focus())
</script>
