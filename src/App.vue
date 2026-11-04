<template>
  <main class="workbench" :class="{ 'workbench--browser': activeTab !== 'home' }">
    <header class="topbar">
      <nav class="tabs" aria-label="工作区标签页">
        <button class="tab tab--home" :class="{ 'is-active': activeTab === 'home' }" type="button" @click="activeTab = 'home'"><LayoutGrid :size="15" /><span>网站合集</span></button>
        <button v-for="tab in browserTabs" :key="tab.id" class="tab tab--site" :class="{ 'is-active': activeTab === tab.id }" type="button" :title="tab.name" @click="activeTab = tab.id">
          <BrandMark :brand="tab.brand" :name="tab.name" :url="tab.url" /><span>{{ tab.name }}</span><span class="tab-close" role="button" tabindex="0" :aria-label="`关闭 ${tab.name}`" @click.stop="closeTab(tab.id)" @keydown.enter.stop="closeTab(tab.id)"><X :size="13" /></span>
        </button>
      </nav>
      <div class="topbar-actions"><button class="icon-button" type="button" aria-label="显示管理" title="显示管理" @click="manageOpen = true"><SlidersHorizontal :size="17" /></button><button class="add-button" type="button" @click="openAdd"><Plus :size="17" /><span>添加网站</span></button></div>
    </header>

    <section v-if="activeTab === 'home'" class="home-view">
      <div class="home-content">
      <div class="home-heading"><img class="home-logo" :src="logoUrl" alt="" /><div><h1>工作台</h1><p class="heading-copy">在 Mira 中打开常用的 AI 与搜索工具。</p></div></div>
      <div class="search-row"><label class="search-box"><Search :size="19" /><input v-model="query" aria-label="搜索网站" placeholder="搜索 AI 助手、搜索工具…" /><kbd>⌘ K</kbd><button v-if="query" type="button" aria-label="清除搜索" @click="query = ''"><X :size="15" /></button></label></div>
      <div class="collection-heading"><div><h2>{{ query ? '搜索结果' : category === 'all' ? '全部网站' : category === 'assistant' ? 'AI 助手' : '搜索工具' }}</h2><span>{{ filteredSites.length }} 个网站</span></div><div class="filters" aria-label="网站分类"><button v-for="filter in filters" :key="filter.id" :class="{ 'is-selected': category === filter.id }" type="button" @click="category = filter.id">{{ filter.name }}</button></div></div>
      <div v-if="filteredSites.length" class="site-grid">
        <button v-for="site in filteredSites" :key="site.id" class="site-card" type="button" @click="openSite(site)">
          <span class="site-card__top"><span class="site-icon"><BrandMark :brand="site.brand" :name="site.name" :url="site.url" /></span><span class="site-arrow"><ArrowUpRight :size="15" /></span></span>
          <span class="site-card__name">{{ site.name }}</span><span class="site-card__url">{{ hostOf(site.url) }}</span>
          <span v-if="!site.builtin" class="custom-mark">自定义</span>
          <span class="site-menu" role="button" tabindex="0" :aria-label="`编辑 ${site.name}`" @click.stop="editSite(site)" @keydown.enter.stop="editSite(site)"><Ellipsis :size="17" /></span>
        </button>
      </div>
      <div v-else class="empty-state"><span><Search :size="22" /></span><strong>没有找到匹配的网站</strong><p>试试其他名称，或添加你自己的网址。</p><button type="button" @click="openAdd"><Plus :size="15" />添加网站</button></div>
      <footer class="home-footer"><span>由 Mira Workbench 整理</span><span>网站内容由各服务提供方负责</span></footer>
      </div>
    </section>

    <section v-else-if="currentSite" class="browser-view">
      <div class="browser-toolbar"><div class="browser-controls"><button type="button" aria-label="返回合集" title="返回合集" @click="activeTab = 'home'"><ArrowLeft :size="17" /></button><button type="button" aria-label="刷新页面" title="刷新页面" @click="reloadFrame"><RotateCw :size="15" /></button></div><div class="address-bar"><LockKeyhole :size="13" /><span>{{ currentAddress }}</span></div><button class="external-button" type="button" @click="openExternal"><ExternalLink :size="15" /><span>在浏览器打开</span></button><button class="icon-button" type="button" aria-label="关闭标签页" @click="closeTab(currentSite.id)"><X :size="16" /></button></div>
      <div class="web-content">
        <webview v-if="isElectron" :key="currentSite.id" ref="webviewEl" class="site-webview" :src="currentSite.url" :partition="`persist:workbench-${currentSite.id}`" webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes,webSecurity=yes" allowpopups="false" @did-navigate="handleNavigate" @did-navigate-in-page="handleNavigate" @did-fail-load="handleLoadError" @will-navigate="handleWillNavigate" @new-window="handleNewWindow" />
        <iframe v-else :key="currentSite.id" class="site-iframe" :src="currentSite.url" :title="`${currentSite.name} 网页`" referrerpolicy="no-referrer" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock allow-presentation" @load="frameLoaded" />
        <div v-if="loadError" class="embed-warning"><div class="warning-icon"><TriangleAlert :size="22" /></div><h2>{{ currentSite.name }}暂时无法在工作台显示</h2><p>{{ loadError }}</p><button class="add-button" type="button" @click="openExternal"><ExternalLink :size="15" />在系统浏览器打开</button><button class="text-button" type="button" @click="loadError = ''">重试嵌入</button></div>
      </div>
    </section>

    <div v-if="siteDialog" class="dialog-backdrop" @click.self="closeSiteDialog">
      <section class="site-dialog" role="dialog" aria-modal="true" :aria-labelledby="'site-dialog-title'"><div class="dialog-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h2 id="site-dialog-title">{{ editingId ? '编辑网站' : '添加网站' }}</h2></div><button class="icon-button" type="button" aria-label="关闭" @click="closeSiteDialog"><X :size="17" /></button></div><form @submit.prevent="saveSite"><label>网站名称<input v-model.trim="form.name" autofocus maxlength="40" placeholder="例如：我的 AI 助手" required /></label><label>网站地址<input v-model.trim="form.url" type="url" placeholder="https://example.com" required /></label><p v-if="formError" class="form-error" role="alert">{{ formError }}</p><div class="dialog-actions"><button v-if="editingId && !editingIsBuiltin" class="delete-button" type="button" @click="deleteSite">删除网站</button><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="closeSiteDialog">取消</button><button class="add-button" type="submit"><Check :size="15" />保存网站</button></div></form></section>
    </div>

    <div v-if="manageOpen" class="dialog-backdrop" @click.self="manageOpen = false"><section class="manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-title"><div class="dialog-heading"><div><p class="eyebrow">COLLECTION SETTINGS</p><h2 id="manage-title">显示管理</h2></div><button class="icon-button" type="button" aria-label="关闭" @click="manageOpen = false"><X :size="17" /></button></div><p class="manage-copy">选择要显示在网站合集中的服务。隐藏的网站可以随时恢复。</p><div class="manage-list"><label v-for="site in sites" :key="site.id" class="manage-item"><BrandMark :brand="site.brand" :name="site.name" :url="site.url" /><span>{{ site.name }}</span><input v-model="site.visible" type="checkbox" :aria-label="`显示 ${site.name}`" /></label></div><div class="dialog-actions"><button class="text-button" type="button" @click="restoreDefaults">恢复默认列表</button><span class="dialog-spacer"></span><button class="add-button" type="button" @click="saveSites(); manageOpen = false"><Check :size="15" />完成</button></div></section></div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowUpRight, Check, Ellipsis, ExternalLink, LayoutGrid, LockKeyhole, Plus, RotateCw, Search, SlidersHorizontal, TriangleAlert, X } from 'lucide-vue-next'
import BrandMark from './components/BrandMark.vue'
import { builtinSites, readSites, sitesStorageKey, type WebsiteEntry, type SiteCategory } from './data/sites'

interface BrowserTab extends WebsiteEntry { currentUrl: string }
const logoUrl = `${import.meta.env.BASE_URL}mira-workbench-logo.png`
const isElectron = Boolean((window as typeof window & { process?: { versions?: { electron?: string } } }).process?.versions?.electron)
const sites = ref(readSites())
const browserTabs = ref<BrowserTab[]>([])
const activeTab = ref('home')
const query = ref('')
const category = ref<'all' | SiteCategory>('all')
const siteDialog = ref(false)
const manageOpen = ref(false)
const editingId = ref('')
const form = ref({ name: '', url: '' })
const formError = ref('')
const loadError = ref('')
const webviewEl = ref<{ reload: () => void; loadURL: (url: string) => void; getURL: () => string } | undefined>()
const filters = [{ id: 'all', name: '全部' }, { id: 'assistant', name: 'AI 助手' }, { id: 'search', name: '搜索' }] as const
const visibleSites = computed(() => sites.value.filter(site => site.visible))
const filteredSites = computed(() => visibleSites.value.filter(site => (category.value === 'all' || site.category === category.value) && `${site.name} ${site.url}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
const currentSite = computed(() => browserTabs.value.find(tab => tab.id === activeTab.value))
const currentAddress = computed(() => currentSite.value?.currentUrl || '')
const editingIsBuiltin = computed(() => sites.value.find(site => site.id === editingId.value)?.builtin ?? false)
watch(sites, saveSites, { deep: true })
function saveSites() { localStorage.setItem(sitesStorageKey, JSON.stringify(sites.value)) }
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
function openSite(site: WebsiteEntry) {
  let tab = browserTabs.value.find(item => item.id === site.id)
  if (!tab) { tab = { ...site, currentUrl: site.url }; browserTabs.value.push(tab) }
  activeTab.value = tab.id
  loadError.value = ''
}
function closeTab(id: string) {
  const index = browserTabs.value.findIndex(tab => tab.id === id)
  if (index < 0) return
  browserTabs.value.splice(index, 1)
  if (activeTab.value === id) activeTab.value = browserTabs.value[Math.max(0, index - 1)]?.id || 'home'
}
function openAdd() {
  editingId.value = ''
  form.value = { name: '', url: '' }
  formError.value = ''
  siteDialog.value = true
}
function editSite(site: WebsiteEntry) {
  editingId.value = site.id
  form.value = { name: site.name, url: site.url }
  formError.value = ''
  siteDialog.value = true
}
function closeSiteDialog() { siteDialog.value = false }
function saveSite() {
  let parsed: URL
  try { parsed = new URL(form.value.url) } catch { formError.value = '请输入有效的网址。'; return }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) { formError.value = '网址必须使用 HTTP 或 HTTPS，且不能包含账号密码。'; return }
  const normalizedUrl = parsed.href
  const duplicate = sites.value.find(site => site.url === normalizedUrl && site.id !== editingId.value)
  if (duplicate) { formError.value = `这个网址已在合集里：${duplicate.name}。`; return }
  if (editingId.value) {
    const target = sites.value.find(site => site.id === editingId.value)
    if (target) { target.name = form.value.name; target.url = normalizedUrl; target.brand = undefined }
  } else {
    sites.value.push({ id: `custom-${crypto.randomUUID()}`, name: form.value.name, url: normalizedUrl, category: 'assistant', builtin: false, visible: true })
  }
  saveSites()
  siteDialog.value = false
}
function deleteSite() {
  const index = sites.value.findIndex(site => site.id === editingId.value && !site.builtin)
  if (index >= 0) sites.value.splice(index, 1)
  closeSiteDialog()
}
function restoreDefaults() { sites.value = structuredClone(builtinSites) }
function openExternal() {
  if (!currentSite.value) return
  window.open(currentSite.value.currentUrl, '_blank', 'noopener,noreferrer')
}
function reloadFrame() { if (isElectron) webviewEl.value?.reload(); else if (currentSite.value) { const frame = document.querySelector<HTMLIFrameElement>('.site-iframe'); if (frame) frame.src = frame.src } }
function frameLoaded() { loadError.value = '' }
function handleNavigate(event: Event) {
  const detail = (event as CustomEvent<{ url?: string }>).detail
  if (detail?.url && currentSite.value) currentSite.value.currentUrl = detail.url
  loadError.value = ''
}
function handleLoadError(event: Event) {
  const detail = (event as CustomEvent<{ errorCode?: number; errorDescription?: string; validatedURL?: string }>).detail
  if (detail.errorCode !== -3) loadError.value = detail.errorDescription || '网络连接失败，请检查网络后重试。'
}
function handleWillNavigate(event: Event) {
  const detail = (event as CustomEvent<{ url?: string }>).detail
  if (!detail?.url || !currentSite.value) return
  try {
    const next = new URL(detail.url)
    if (!['http:', 'https:'].includes(next.protocol)) { event.preventDefault(); window.open(detail.url, '_blank', 'noopener,noreferrer'); return }
    if (next.origin !== new URL(currentSite.value.currentUrl).origin) {
      event.preventDefault()
      window.open(next.href, '_blank', 'noopener,noreferrer')
    }
  } catch { event.preventDefault() }
}
function handleNewWindow(event: Event) {
  const detail = (event as CustomEvent<{ url?: string }>).detail
  if (detail?.url) window.open(detail.url, '_blank', 'noopener,noreferrer')
}
function onShortcuts(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); activeTab.value = 'home'; document.querySelector<HTMLInputElement>('.search-box input')?.focus() }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 't') { event.preventDefault(); activeTab.value = 'home'; openAdd() }
  if (event.key === 'Escape') { if (siteDialog.value) closeSiteDialog(); else if (manageOpen.value) manageOpen.value = false }
}
onMounted(() => window.addEventListener('keydown', onShortcuts))
onUnmounted(() => window.removeEventListener('keydown', onShortcuts))
</script>
