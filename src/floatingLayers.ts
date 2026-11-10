import { ref } from 'vue'

// Native website views must stay below Workbench until every floating layer has left.
export const floatingLayerCount = ref(0)
