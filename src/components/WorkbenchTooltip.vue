<template>
  <Teleport to="body"><FloatingTransition><div v-if="visible" id="workbench-tooltip" ref="surface" class="workbench-tooltip" role="tooltip" :data-side="position.side" :style="{ left: `${position.x}px`, top: `${position.y}px` }">{{ text }}</div></FloatingTransition></Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import FloatingTransition from './FloatingTransition.vue'

const surface = ref<HTMLElement>(), visible = ref(false), text = ref('')
const position = ref({ x: 0, y: 0, side: 'bottom' })
let trigger: HTMLElement | undefined, timer: number | undefined
function hide() {
  window.clearTimeout(timer)
  const describedBy = trigger?.getAttribute('aria-describedby')?.split(' ').filter(id => id !== 'workbench-tooltip').join(' ')
  if (describedBy) trigger?.setAttribute('aria-describedby', describedBy); else trigger?.removeAttribute('aria-describedby')
  trigger = undefined; visible.value = false
}
function show(event: Event) {
  const target = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]')
  if (!target || !target.dataset.tooltip || target.matches(':disabled, [aria-disabled="true"]') || target === trigger) return
  hide(); trigger = target
  timer = window.setTimeout(async () => {
    if (trigger !== target || !target.isConnected || !target.dataset.tooltip) return
    text.value = target.dataset.tooltip
    const bounds = target.getBoundingClientRect()
    position.value = { x: bounds.left, y: bounds.bottom + 6, side: target.dataset.tooltipSide || 'bottom' }
    target.setAttribute('aria-describedby', [target.getAttribute('aria-describedby'), 'workbench-tooltip'].filter(Boolean).join(' '))
    visible.value = true
    await nextTick()
    if (trigger !== target || !surface.value) return
    const width = surface.value.offsetWidth, height = surface.value.offsetHeight
    let side = position.value.side, x = bounds.left + (bounds.width - width) / 2, y = bounds.bottom + 6
    if (side === 'left') { x = bounds.left - width - 6; y = bounds.top + (bounds.height - height) / 2 }
    if (side === 'bottom' && y + height > window.innerHeight - 8) { side = 'top'; y = bounds.top - height - 6 }
    position.value = { x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - height - 8)), side }
  }, 350)
}
function leave(event: Event) { const target = (event as FocusEvent).relatedTarget; if (trigger && (!(target instanceof Node) || !trigger.contains(target))) hide() }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') hide() }
onMounted(() => {
  document.addEventListener('pointerover', show); document.addEventListener('pointerout', leave)
  document.addEventListener('focusin', show); document.addEventListener('focusout', leave)
  document.addEventListener('pointerdown', hide); document.addEventListener('click', hide); document.addEventListener('keydown', keydown)
  window.addEventListener('blur', hide); window.addEventListener('resize', hide); window.addEventListener('scroll', hide, true)
})
onUnmounted(() => {
  hide()
  document.removeEventListener('pointerover', show); document.removeEventListener('pointerout', leave)
  document.removeEventListener('focusin', show); document.removeEventListener('focusout', leave)
  document.removeEventListener('pointerdown', hide); document.removeEventListener('click', hide); document.removeEventListener('keydown', keydown)
  window.removeEventListener('blur', hide); window.removeEventListener('resize', hide); window.removeEventListener('scroll', hide, true)
})
</script>
