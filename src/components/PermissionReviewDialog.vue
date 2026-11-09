<template>
  <div class="dialog-backdrop" @keydown.esc.stop="$emit('finish', false)"><section ref="dialog" class="site-dialog add-dialog review-dialog" role="alertdialog" aria-modal="true" aria-labelledby="review-title" tabindex="-1" @keydown.tab="trapFocus">
    <h2 id="review-title">{{ review.title }}</h2><p>{{ review.message }}</p>
    <template v-if="review.permissions"><p class="manage-copy">此小程序申请以下能力：</p><ul class="permission-summary"><li v-for="permission in review.permissions" :key="permission">{{ permission }}</li><li v-if="!review.permissions.length">未申请额外能力</li></ul></template>
    <div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="$emit('finish', false)">取消</button><button class="add-button" type="button" @click="$emit('finish', true)">{{ review.confirm }}</button></div>
  </section></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ReviewRequest } from '../miniapps/manager'

defineProps<{ review: ReviewRequest }>()
defineEmits<{ finish: [approved: boolean] }>()
const dialog = ref<HTMLElement>()
function trapFocus(event: KeyboardEvent) {
  const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('button')
  if (!buttons?.length) return
  if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialog.value)) { event.preventDefault(); buttons[buttons.length - 1]?.focus() }
  else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus() }
}
onMounted(() => dialog.value?.focus())
</script>
