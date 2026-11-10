<template>
  <div class="dialog-backdrop dialog-backdrop--floating" @click.self="$emit('close')" @keydown.esc.stop="$emit('close')">
    <section ref="dialog" class="site-dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="site-dialog-title" tabindex="-1" @keydown.tab="trapFocus">
      <div class="dialog-heading"><h2 id="site-dialog-title">{{ site ? '编辑网站' : '添加' }}</h2><button class="icon-button" type="button" aria-label="关闭" @click="$emit('close')"><X :size="17" /></button></div>
      <div v-if="!site" class="add-tabs" role="tablist" aria-label="新增类型">
        <button id="add-website-tab" type="button" role="tab" :aria-selected="addType === 'website'" aria-controls="add-website-panel" :tabindex="addType === 'website' ? 0 : -1" @click="addType = 'website'" @keydown.right.prevent="selectAddType('miniapp')" @keydown.left.prevent="selectAddType('miniapp')"><Globe :size="17" />网站</button>
        <button id="add-miniapp-tab" type="button" role="tab" :aria-selected="addType === 'miniapp'" aria-controls="add-miniapp-panel" :tabindex="addType === 'miniapp' ? 0 : -1" @click="addType = 'miniapp'" @keydown.right.prevent="selectAddType('website')" @keydown.left.prevent="selectAddType('website')"><Package :size="17" />小程序</button>
      </div>
      <form v-show="addType === 'website'" id="add-website-panel" :role="site ? undefined : 'tabpanel'" :aria-labelledby="site ? undefined : 'add-website-tab'" @submit.prevent="save">
        <div class="logo-upload">
          <button class="site-icon logo-preview" type="button" aria-label="上传网站 Logo" :aria-busy="uploading || fetching" :disabled="uploading" @click="logoInput?.click()"><LoaderCircle v-if="uploading || fetching" class="tab-loading-indicator" :size="28" role="status" aria-label="正在加载 Logo" /><BrandMark v-else :brand="site?.url === formAddress ? site.brand : undefined" :name="form.name" :url="form.url" :custom-icon="form.iconUrl" :cached-icon="preview?.url === formAddress ? preview.icon : undefined" /></button>
          <input ref="logoInput" class="logo-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" aria-label="选择 Logo 文件" @change="uploadLogo" />
          <div class="logo-upload-actions"><button class="cancel-button" type="button" :disabled="uploading" @click="logoInput?.click()"><Upload :size="15" />{{ uploading ? '正在处理…' : '上传 Logo 文件' }}</button><button v-if="form.iconUrl" class="text-button" type="button" :disabled="uploading" @click="form.iconUrl = ''">恢复默认图标</button></div>
        </div>
        <label><span>网站名称 <span class="required-mark">*</span></span><input v-model.trim="form.name" maxlength="40" placeholder="请输入名称" required /></label>
        <label><span>网站地址 <span class="required-mark">*</span></span><input v-model.trim="form.url" type="url" placeholder="请输入网站地址" required /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="dialog-actions"><button v-if="site && !site.builtin" class="delete-button" type="button" @click="$emit('delete', site)">删除网站</button><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="$emit('close')">取消</button><button class="add-button" type="submit" :disabled="uploading || fetching || !form.name || !form.url"><Check :size="15" />保存</button></div>
      </form>
      <div v-if="addType === 'miniapp'" id="add-miniapp-panel" role="tabpanel" aria-labelledby="add-miniapp-tab">
        <p class="miniapp-info"><Package :size="20" /><span>安装授权后可以调用本地能力</span></p>
        <input ref="miniappInput" class="logo-file-input" type="file" accept=".miniapp,.zip" aria-label="选择小程序安装包" @change="$emit('select-miniapp', $event)" /><div class="miniapp-upload"><p>选择一个 .miniapp 或 .zip 安装包，安装前会展示它申请的权限。</p><button class="cancel-button" type="button" :disabled="!isPlatformApp || managingMiniapp" @click="miniappInput?.click()"><Upload :size="15" />{{ managingMiniapp ? '正在安装…' : '选择文件…' }}</button><p v-if="!isPlatformApp" class="miniapp-unavailable">请在 Mira 桌面应用中安装小程序。</p></div>
        <p v-if="miniappError" class="form-error" role="alert">{{ miniappError }}</p><p v-if="miniappNotice" class="miniapp-notice" role="status">{{ miniappNotice }}</p>
        <div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="$emit('close')">{{ miniappNotice ? '完成' : '取消' }}</button></div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Check, Globe, LoaderCircle, Package, Upload, X } from 'lucide-vue-next'
import BrandMark from './BrandMark.vue'
import type { WebsiteEntry } from '../data/sites'

const props = defineProps<{ site?: WebsiteEntry; sites: WebsiteEntry[]; loadIcon: (url: string) => Promise<string | undefined>; isPlatformApp: boolean; managingMiniapp: boolean; miniappError: string; miniappNotice: string }>()
const emit = defineEmits<{ close: []; save: [value: { name: string; url: string; iconUrl?: string; cachedIcon?: string }]; delete: [site: WebsiteEntry]; 'select-miniapp': [event: Event] }>()
const dialog = ref<HTMLElement>(), logoInput = ref<HTMLInputElement>(), miniappInput = ref<HTMLInputElement>()
const addType = ref<'website' | 'miniapp'>('website')
const form = ref({ name: props.site?.name || '', url: props.site?.url || '', iconUrl: props.site?.iconUrl || '' })
const error = ref(''), uploading = ref(false), fetching = ref(false)
const preview = ref<{ url: string; icon?: string }>()
const formAddress = computed(() => { try { return new URL(form.value.url).href } catch { return '' } })
watch([addType, () => form.value.url, () => form.value.iconUrl, uploading], (_values, _previous, onCleanup) => {
  fetching.value = false
  if (addType.value !== 'website' || form.value.iconUrl || uploading.value) return
  let url: URL
  try { url = new URL(form.value.url) } catch { return }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
  if (props.site?.url === url.href && (props.site.cachedIcon || props.site.brand)) { preview.value = { url: url.href, icon: props.site.cachedIcon }; return }
  if (preview.value?.url === url.href) return
  let cancelled = false
  fetching.value = true
  const timer = window.setTimeout(async () => {
    try { const icon = await props.loadIcon(url.href); if (!cancelled) preview.value = { url: url.href, icon } }
    catch { if (!cancelled) preview.value = { url: url.href } }
    finally { if (!cancelled) fetching.value = false }
  }, 500)
  onCleanup(() => { cancelled = true; window.clearTimeout(timer) })
}, { immediate: true })
function selectAddType(type: 'website' | 'miniapp') { addType.value = type; void nextTick(() => document.getElementById(`add-${type}-tab`)?.focus()) }
function trapFocus(event: KeyboardEvent) {
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])].filter(element => element.offsetParent !== null && element.tabIndex >= 0)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''
  if (!file) return
  error.value = ''
  if (!file.type.startsWith('image/')) { error.value = '请选择图片文件。'; return }
  if (file.size > 5 * 1024 * 1024) { error.value = 'Logo 文件不能超过 5 MB，请选择较小的图片。'; return }
  uploading.value = true
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image(); image.src = objectUrl; await image.decode()
    const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    form.value.iconUrl = canvas.toDataURL('image/png')
  } catch { error.value = '无法读取这张图片，请选择其他 Logo 文件。' }
  finally { URL.revokeObjectURL(objectUrl); uploading.value = false }
}
function save() {
  if (uploading.value || fetching.value || !form.value.name) return
  let parsed: URL
  try { parsed = new URL(form.value.url) } catch { error.value = '请输入有效的网址。'; return }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) { error.value = '网址必须使用 HTTP 或 HTTPS，且不能包含账号密码。'; return }
  let iconUrl: string | undefined
  if (form.value.iconUrl) {
    try { const icon = new URL(form.value.iconUrl); if (!(icon.protocol === 'https:' || /^data:image\/png;base64,/.test(form.value.iconUrl)) || icon.username || icon.password) throw new Error(); iconUrl = icon.href }
    catch { error.value = 'Logo 无效，请重新上传图片。'; return }
  }
  const duplicate = props.sites.find(site => site.url === parsed.href && site.id !== props.site?.id)
  if (duplicate) { error.value = `这个网址已在合集里：${duplicate.name}。`; return }
  const cachedIcon = preview.value?.url === parsed.href ? preview.value.icon : props.site?.url === parsed.href ? props.site.cachedIcon : undefined
  emit('save', { name: form.value.name, url: parsed.href, iconUrl, cachedIcon })
}
onMounted(() => dialog.value?.focus())
</script>
