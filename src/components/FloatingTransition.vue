<template>
  <Transition :name="kind === 'dialog' ? 'floating-dialog' : 'floating-surface'" appear @before-enter="retain" @after-leave="release"><slot /></Transition>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import { floatingLayerCount } from '../floatingLayers'

defineProps<{ kind?: 'dialog' }>()
const retained = new Set<Element>()
function retain(element: Element) { if (!retained.has(element)) { retained.add(element); floatingLayerCount.value++ } }
function release(element: Element) { if (retained.delete(element)) floatingLayerCount.value-- }
onUnmounted(() => { floatingLayerCount.value -= retained.size; retained.clear() })
</script>
