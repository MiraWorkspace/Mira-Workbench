<template>
  <main class="workbench" :class="{ 'workbench--browser': activeTab !== 'home' }">
    <div v-if="storageLoading || storageError" class="dialog-backdrop"><section class="site-dialog" role="alertdialog" aria-modal="true"><h2>{{ storageLoading ? '正在加载工作台' : '工作台数据不可用' }}</h2><p v-if="storageError">{{ storageError }}</p><div v-if="storageError" class="dialog-actions"><button class="add-button" type="button" @click="retryStorage">重试</button></div></section></div>
    <header class="topbar">
      <nav class="tabs" aria-label="工作区标签页">
        <button class="tab tab--home" :class="{ 'is-active': activeTab === 'home' }" type="button" @click="activeTab = 'home'"><img class="workbench-tab-logo" :src="logoUrl" alt="" /><span>工作台</span></button>
        <button v-for="tab in browserTabs" :key="tab.id" class="tab tab--site" :class="{ 'is-active': activeTab === tab.id }" type="button" :title="tabLabel(tab)" @click="activateTab(tab.id)">
          <LoaderCircle v-if="tab.loading" class="tab-loading-indicator" :size="17" /><BrandMark v-else :brand="tab.brand" :name="tab.name" :url="tab.url" :favicon="tab.faviconUrl" :custom-icon="tab.iconUrl" /><span>{{ tabLabel(tab) }}</span><span class="tab-close" role="button" tabindex="0" :aria-label="`关闭 ${tabLabel(tab)}`" @click.stop="closeTab(tab.id)" @keydown.enter.stop="closeTab(tab.id)"><X :size="13" /></span>
        </button>
        <button v-for="tab in miniappTabs" :key="tab.id" class="tab tab--site" :class="{ 'is-active': activeTab === tab.id }" type="button" @click="activateTab(tab.id)"><span>{{ tab.name }}</span><span class="tab-close" role="button" tabindex="0" :aria-label="`关闭 ${tab.name}`" @click.stop="closeMiniapp(tab.id)" @keydown.enter.stop="closeMiniapp(tab.id)"><X :size="13" /></span></button>
      </nav>
      <div class="topbar-actions"><button v-if="isPlatformApp" class="icon-button" type="button" aria-label="安装小程序" data-tooltip="安装小程序" :disabled="managingMiniapp" @click="installMiniapp"><PackagePlus :size="17" /></button><button class="icon-button" type="button" aria-label="显示管理" data-tooltip="显示管理" @click="manageOpen = true"><SlidersHorizontal :size="17" /></button><button class="icon-button" type="button" aria-label="添加网站" data-tooltip="添加网站" @click="openAdd"><Plus :size="17" /></button></div>
    </header>

    <section v-show="activeTab === 'home'" class="home-view">
      <div class="home-content">
      <div class="search-row"><label class="search-box"><Search :size="18" /><input v-model="query" aria-label="搜索网站" placeholder="搜索" /><button v-if="query" type="button" aria-label="清除搜索" @click="query = ''"><X :size="15" /></button></label></div>
      <div v-if="filteredSites.length" class="site-grid">
        <button v-for="site in filteredSites" :key="site.id" class="site-card" type="button" @click="openSite(site)">
          <span class="site-icon"><BrandMark :brand="site.brand" :name="site.name" :url="site.url" :custom-icon="site.iconUrl" /></span>
          <span class="site-card__name">{{ site.name }}</span>
          <span v-if="!site.builtin" class="custom-mark">自定义</span>
        </button>
      </div>
      <div v-if="filteredMiniapps.length" class="site-grid"><button v-for="item in filteredMiniapps" :key="item.id" class="site-card" type="button" :disabled="!item.enabled || openingMiniapp" @click="openMiniapp(item)"><span class="site-icon"><img v-if="item.icon" :src="item.icon" alt="" width="40" height="40" @error="item.icon = undefined" /><span v-else>{{ item.name.slice(0, 1) }}</span></span><span class="site-card__name">{{ item.name }}</span></button></div>
      <p v-if="miniappError" role="alert">{{ miniappError }}</p><p v-if="miniappNotice" role="status">{{ miniappNotice }}</p>
      <div v-if="!filteredSites.length && !filteredMiniapps.length" class="empty-state"><span><Search :size="22" /></span><strong>没有找到匹配的网站或小程序</strong><p>试试其他名称，或添加你自己的网址。</p><button type="button" @click="openAdd"><Plus :size="15" />添加网站</button></div>
      </div>
    </section>

    <section v-if="browserTabs.length" v-show="Boolean(currentSite)" class="browser-view">
      <div class="browser-toolbar"><div class="browser-controls"><button type="button" aria-label="后退" title="后退" :disabled="!currentSite?.canGoBack" @click="goBack"><ArrowLeft :size="17" /></button><button type="button" aria-label="前进" title="前进" :disabled="!currentSite?.canGoForward" @click="goForward"><ArrowRight :size="17" /></button><button v-if="pageLoading" type="button" aria-label="停止加载" title="停止加载" @click="stopFrame"><X :size="18" /></button><button v-else type="button" aria-label="刷新页面" title="刷新页面" @click="reloadFrame"><RotateCw :size="15" /></button></div><div class="address-bar"><LockKeyhole :size="13" /><span>{{ currentAddress }}</span></div><button class="external-button" type="button" @click="openExternal"><ExternalLink :size="15" /><span>在浏览器打开</span></button><button class="icon-button" type="button" aria-label="关闭标签页" @click="currentSite && closeTab(currentSite.id)"><X :size="16" /></button></div>
      <div ref="webContent" class="web-content">
        <template v-if="isElectron">
          <webview v-for="tab in browserTabs" :key="tab.id" :ref="webviewRef(tab.id)" v-show="activeTab === tab.id" class="site-webview" :src="tab.currentUrl" partition="persist:mira-workbench" webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes,webSecurity=yes" allowpopups @did-start-loading="handleLoadStart(tab.id)" @did-stop-loading="handleLoadFinished(tab.id)" @did-navigate="handleNavigate(tab.id, $event)" @did-navigate-in-page="handleNavigate(tab.id, $event)" @page-title-updated="handleTitleUpdate(tab.id, $event)" @page-favicon-updated="handleFaviconUpdate(tab.id, $event)" @did-fail-load="handleLoadError(tab.id, $event)" @will-navigate="handleWillNavigate(tab.id, $event)" />
        </template>
        <iframe v-else-if="currentSite && !hostBrowserReady && !browserConnecting" :key="currentSite.id" class="site-iframe" :src="currentSite.url" :title="`${currentSite.name} 网页`" referrerpolicy="no-referrer" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock allow-presentation" @load="frameLoaded" />
        <div v-if="loadError && currentSite" class="embed-warning"><div class="warning-icon"><TriangleAlert :size="22" /></div><h2>{{ currentSite.name }}暂时无法在工作台显示</h2><p>{{ loadError }}</p><button class="add-button" type="button" @click="openExternal"><ExternalLink :size="15" />在系统浏览器打开</button><button class="text-button" type="button" @click="reloadFrame">重试嵌入</button></div>
      </div>
    </section>
    <section v-if="miniappTabs.length" v-show="Boolean(currentMiniapp)" ref="miniappStage" class="browser-view" />

    <div v-if="siteDialog" class="dialog-backdrop" @click.self="closeSiteDialog" @keydown.esc.stop="closeSiteDialog">
      <section class="site-dialog" role="dialog" aria-modal="true" :aria-labelledby="'site-dialog-title'"><div class="dialog-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h2 id="site-dialog-title">{{ editingId ? '编辑网站' : '添加网站' }}</h2></div><button class="icon-button" type="button" aria-label="关闭" @click="closeSiteDialog"><X :size="17" /></button></div><form @submit.prevent="saveSite"><label>网站名称<input v-model.trim="form.name" autofocus maxlength="40" placeholder="例如：我的 AI 助手" required /></label><label>网站地址<input v-model.trim="form.url" type="url" placeholder="https://example.com" required /></label><label>备用图标地址（可选）<input v-model.trim="form.iconUrl" type="url" placeholder="https://example.com/icon.png" /></label><p v-if="formError" class="form-error" role="alert">{{ formError }}</p><div class="dialog-actions"><button v-if="editingId && !editingIsBuiltin" class="delete-button" type="button" @click="deleteSite">删除网站</button><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="closeSiteDialog">取消</button><button class="add-button" type="submit"><Check :size="15" />保存网站</button></div></form></section>
    </div>

    <div v-if="manageOpen" class="dialog-backdrop" @click.self="manageOpen = false" @keydown.esc.stop="manageOpen = false"><section class="manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-title"><div class="dialog-heading"><div><p class="eyebrow">COLLECTION SETTINGS</p><h2 id="manage-title">显示管理</h2></div><button class="icon-button" type="button" aria-label="关闭" @click="manageOpen = false"><X :size="17" /></button></div><p class="manage-copy">选择要显示的网站和小程序。</p><div class="manage-list"><div v-for="site in sites" :key="site.id" class="manage-item"><BrandMark :brand="site.brand" :name="site.name" :url="site.url" /><span>{{ site.name }}</span><button class="text-button manage-edit" type="button" :aria-label="`编辑 ${site.name}`" @click="manageOpen = false; editSite(site)">编辑</button><input v-model="site.visible" type="checkbox" :aria-label="`显示 ${site.name}`" /></div><div v-for="item in miniapps" :key="item.id" class="manage-item"><span>{{ item.name.slice(0, 1) }}</span><span>{{ item.name }}</span><button v-if="item.approved" class="text-button" type="button" :disabled="managingMiniapp" @click="manageMiniapp(item, 'revoke')">撤销权限</button><button class="text-button" type="button" :disabled="managingMiniapp" @click="manageMiniapp(item, 'uninstall')">卸载</button><input type="checkbox" :aria-label="`显示 ${item.name}`" :checked="miniappVisible(item.id)" @change="setMiniappVisible(item.id, ($event.target as HTMLInputElement).checked)" /></div></div><p v-if="miniappError" role="alert">{{ miniappError }}</p><div class="dialog-actions"><button class="text-button" type="button" @click="restoreDefaults">恢复默认列表</button><span class="dialog-spacer"></span><button class="add-button" type="button" @click="saveSites(); manageOpen = false"><Check :size="15" />完成</button></div></section></div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, ExternalLink, LoaderCircle, LockKeyhole, PackagePlus, Plus, RotateCw, Search, SlidersHorizontal, TriangleAlert, X } from 'lucide-vue-next'
import BrandMark from './components/BrandMark.vue'
import { builtinSites, readSites, sitesStorageKey, type WebsiteEntry } from './data/sites'
import { connectHostBrowser, connectPlatformBrowser, type HostBrowserState } from './hostBrowser'
import { WorkbenchStore, type WorkbenchEntry } from './data/workbenchStore'
import { connectMiraApp, type MiraAppSdk } from '@mira/app-sdk'

interface BrowserTab extends WebsiteEntry { currentUrl: string; loading: boolean; pageTitle: string; canGoBack: boolean; canGoForward: boolean; error?: string; faviconUrl?: string | null }
type BrowserWebview = HTMLElement & { reload: () => void; stop: () => void; getTitle: () => string; canGoBack: () => boolean; canGoForward: () => boolean; goBack: () => void; goForward: () => void }
const logoUrl = `${import.meta.env.BASE_URL}mira-workbench-logo.png`
const isElectron = typeof (document.createElement('webview') as HTMLElement & { getWebContentsId?: unknown }).getWebContentsId === 'function'
const isPlatformApp = typeof (window as Window & { miraAppHost?: { ready?: unknown } }).miraAppHost?.ready === 'function'
const hostBrowserReady = ref(false)
const browserConnecting = ref(isPlatformApp || (!isElectron && window.parent !== window && /Electron\//.test(navigator.userAgent)))
const webContent = ref<HTMLDivElement>()
let hostBrowser: ReturnType<typeof connectHostBrowser> | undefined
let browserResize: ResizeObserver | undefined
let browserConnectTimer: number | undefined
const sites = ref(isPlatformApp ? [] : readSites())
type InstalledMiniapp = { id: string; name: string; icon?: string; enabled: boolean; approved: boolean }
const miniapps = ref<InstalledMiniapp[]>([])
const miniappTabs = ref<Array<{ id: string; name: string; viewId: number }>>([])
const miniappStage = ref<HTMLElement>()
const openingMiniapp = ref(false)
const miniappError = ref('')
const miniappNotice = ref('')
const managingMiniapp = ref(false)
const storageLoading = ref(isPlatformApp)
const storageError = ref('')
let sdk: MiraAppSdk | undefined
let store: WorkbenchStore | undefined
const otherEntries = ref<WorkbenchEntry[]>([])
let initialized = false
let saving = false
let dirty = false
let themeUnsubscribe: (() => void) | undefined
const browserTabs = ref<BrowserTab[]>([])
const activeTab = ref('home')
const query = ref('')
const siteDialog = ref(false)
const manageOpen = ref(false)
const editingId = ref('')
const form = ref({ name: '', url: '', iconUrl: '' })
const formError = ref('')
const loadError = ref('')
const webviewEls = new Map<string, BrowserWebview>()
const titleRefreshTimers = new Map<string, number[]>()
const visibleSites = computed(() => sites.value.filter(site => site.visible))
const filteredSites = computed(() => visibleSites.value.filter(site => `${site.name} ${site.url}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
const currentSite = computed(() => browserTabs.value.find(tab => tab.id === activeTab.value))
const currentMiniapp = computed(() => miniappTabs.value.find(tab => tab.id === activeTab.value))
const filteredMiniapps = computed(() => miniapps.value.filter(item => miniappVisible(item.id) && `${item.name} ${item.id}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
const currentAddress = computed(() => currentSite.value?.currentUrl || '')
const pageLoading = computed(() => currentSite.value?.loading ?? false)
const editingIsBuiltin = computed(() => sites.value.find(site => site.id === editingId.value)?.builtin ?? false)
watch(sites, () => { if (initialized || !isPlatformApp) saveSites() }, { deep: true, flush: 'sync' })
watch([activeTab, siteDialog, manageOpen, loadError, hostBrowserReady, storageError, storageLoading], () => { void nextTick(() => { syncHostBrowserLayout(); syncMiniappLayout() }) })
watch(miniappStage, (element, previous) => { if (previous) browserResize?.unobserve(previous); if (element) browserResize?.observe(element); syncMiniappLayout() })
watch(webContent, (element, previous) => { if (previous) browserResize?.unobserve(previous); if (element) browserResize?.observe(element); syncHostBrowserLayout() })
function siteToEntry(site: WebsiteEntry): WorkbenchEntry { return { id: site.id, type: 'website', name: site.name, address: site.url, icon: site.iconUrl || site.brand, category: site.category, builtin: site.builtin, visible: site.visible } }
function entryToSite(entry: WorkbenchEntry): WebsiteEntry { const iconUrl = entry.icon?.startsWith('https://') ? entry.icon : undefined; const builtin = entry.builtin ? builtinSites.find(site => site.id === entry.id && site.url === entry.address) : undefined; return { id: entry.id, name: entry.name, url: entry.address, category: entry.category === 'search' ? 'search' : 'assistant', brand: builtin?.id, iconUrl, builtin: entry.builtin, visible: entry.visible } }
async function initializeStorage() {
  storageLoading.value = true; storageError.value = ''
  try {
    sdk ??= await connectMiraApp()
    const context = await sdk.context.get()
    if (context.appId !== __MIRA_APP_ID__) throw new Error('工作台应用身份不匹配')
    if (!hostBrowser) {
      hostBrowser = connectPlatformBrowser(sdk, handleHostBrowserState, url => openBrowserTab(url))
      hostBrowserReady.value = true; browserConnecting.value = false
      browserResize = new ResizeObserver(() => { syncHostBrowserLayout(); syncMiniappLayout() })
      if (webContent.value) browserResize.observe(webContent.value)
      if (miniappStage.value) browserResize.observe(miniappStage.value)
      void nextTick(syncHostBrowserLayout)
    }
    if (!themeUnsubscribe) themeUnsubscribe = sdk.appearance.subscribe(applyTheme)
    applyTheme(await sdk.appearance.get())
    store ??= new WorkbenchStore(sdk.storage)
    const entries = await store.initialize(() => sdk!.storage.importLegacyWorkbenchSites(), builtinSites.map(siteToEntry))
    otherEntries.value = entries.filter(item => item.type !== 'website')
    sites.value = entries.filter(item => item.type === 'website').map(entryToSite)
    initialized = true
    await refreshMiniapps()
  } catch (error) { storageError.value = error instanceof Error ? error.message : '读取数据失败' }
  finally { storageLoading.value = false }
}
function saveSites() {
  if (!isPlatformApp) { localStorage.setItem(sitesStorageKey, JSON.stringify(sites.value)); return }
  if (!initialized) return
  dirty = true
  void flushSites()
}
async function flushSites() {
  if (saving || !store || !dirty) return
  saving = true
  try {
    while (dirty) {
      dirty = false
      await store.save([...sites.value.map(siteToEntry), ...otherEntries.value.map(item => ({ ...item }))])
    }
    storageError.value = ''
  } catch (error) { dirty = true; storageError.value = error instanceof Error ? error.message : '保存数据失败' }
  finally { saving = false }
}
function retryStorage() { if (initialized) { storageError.value = ''; void flushSites() } else void initializeStorage() }
async function installMiniapp() {
  if (!sdk || managingMiniapp.value) return
  managingMiniapp.value = true; miniappError.value = ''; miniappNotice.value = ''
  try { if (await sdk.workbench.install()) miniappNotice.value = '小程序已安装或更新，重启 Mira 后生效。' }
  catch (error) { miniappError.value = error instanceof Error ? error.message : '安装失败' }
  finally { managingMiniapp.value = false }
}
async function manageMiniapp(item: InstalledMiniapp, action: 'uninstall' | 'revoke') {
  if (!sdk || managingMiniapp.value) return
  managingMiniapp.value = true; miniappError.value = ''; miniappNotice.value = ''
  try {
    const changed = action === 'uninstall' ? await sdk.workbench.uninstall(item.id) : await sdk.workbench.revoke(item.id)
    if (changed) { await refreshMiniapps(); if (action === 'uninstall') miniappNotice.value = '小程序已卸载，重启 Mira 后完成。' }
  } catch (error) { miniappError.value = error instanceof Error ? error.message : '操作失败' }
  finally { managingMiniapp.value = false }
}
async function refreshMiniapps() {
  if (!sdk) return
  try {
    miniapps.value = await sdk.workbench.apps()
    const added = miniapps.value.filter(item => !otherEntries.value.some(entry => entry.type === 'miniapp' && entry.address === item.id))
    if (added.length) { otherEntries.value.push(...added.map(item => ({ id: `miniapp:${item.id}`, type: 'miniapp' as const, name: item.name, address: item.id, builtin: false, visible: true }))); saveSites() }
    miniappError.value = ''
  } catch { miniappError.value = '小程序列表加载失败。' }
}
function miniappVisible(id: string) { return otherEntries.value.find(entry => entry.type === 'miniapp' && entry.address === id)?.visible !== false }
function setMiniappVisible(id: string, visible: boolean) {
  const entry = otherEntries.value.find(item => item.type === 'miniapp' && item.address === id)
  if (entry) { entry.visible = visible; saveSites() }
}
async function openMiniapp(item: InstalledMiniapp) {
  if (!sdk || openingMiniapp.value) return
  const existing = miniappTabs.value.find(tab => tab.id === `miniapp:${item.id}`)
  if (existing) { activateTab(existing.id); return }
  openingMiniapp.value = true; miniappError.value = ''
  try {
    if (!item.approved && !await sdk.workbench.review(item.id)) return
    const viewId = await sdk.workbench.app({ type: 'open', appId: item.id })
    if (typeof viewId !== 'number') throw new Error('小程序打开失败')
    item.approved = true
    const tab = { id: `miniapp:${item.id}`, name: item.name, viewId }
    miniappTabs.value.push(tab); activeTab.value = tab.id
    await nextTick(); syncMiniappLayout()
  } catch (error) { miniappError.value = error instanceof Error ? error.message : '小程序打开失败' }
  finally { openingMiniapp.value = false }
}
function syncMiniappLayout() {
  if (!sdk) return
  const bounds = miniappStage.value?.getBoundingClientRect()
  for (const tab of miniappTabs.value) void sdk.workbench.app({ type: 'layout', id: tab.viewId, visible: tab.id === activeTab.value && !siteDialog.value && !manageOpen.value && !storageError.value && !storageLoading.value && Boolean(bounds?.width && bounds.height), bounds: bounds ? { x: Math.max(0, bounds.x), y: Math.max(0, bounds.y), width: bounds.width, height: bounds.height } : { x: 0, y: 0, width: 0, height: 0 } }).catch(() => undefined)
}
function closeMiniapp(id: string) {
  const index = miniappTabs.value.findIndex(tab => tab.id === id)
  if (index < 0) return
  const [tab] = miniappTabs.value.splice(index, 1)
  void sdk?.workbench.app({ type: 'close', id: tab.viewId }).catch(() => undefined)
  if (activeTab.value === id) activeTab.value = 'home'
}
function openSite(site: WebsiteEntry) {
  const tab = browserTabs.value.find(item => item.id === site.id)
  if (tab) { activateTab(tab.id); return }
  openBrowserTab(site.url, site)
}
function openBrowserTab(value: string, site?: WebsiteEntry) {
  let url: URL
  try { url = new URL(value) } catch { return }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
  const tab: BrowserTab = site
    ? { ...site, currentUrl: url.href, loading: true, pageTitle: '', canGoBack: false, canGoForward: false }
    : { id: `browser-${crypto.randomUUID()}`, name: '', url: url.href, currentUrl: url.href, category: 'assistant', builtin: false, visible: true, loading: true, pageTitle: '', canGoBack: false, canGoForward: false }
  browserTabs.value.push(tab)
  activeTab.value = tab.id
  loadError.value = ''
  if (hostBrowserReady.value) hostBrowser?.open(tab.id, tab.currentUrl)
}
function activateTab(id: string) { activeTab.value = id; loadError.value = tabById(id)?.error || '' }
function closeTab(id: string) {
  const index = browserTabs.value.findIndex(tab => tab.id === id)
  if (index < 0) return
  clearTitleRefresh(id)
  hostBrowser?.control(id, 'close')
  webviewEls.delete(id)
  browserTabs.value.splice(index, 1)
  if (activeTab.value === id) {
    activeTab.value = browserTabs.value[Math.max(0, index - 1)]?.id || 'home'
    loadError.value = currentSite.value?.error || ''
  }
}
function openAdd() {
  editingId.value = ''
  form.value = { name: '', url: '', iconUrl: '' }
  formError.value = ''
  siteDialog.value = true
}
function editSite(site: WebsiteEntry) {
  editingId.value = site.id
  form.value = { name: site.name, url: site.url, iconUrl: site.iconUrl || '' }
  formError.value = ''
  siteDialog.value = true
}
function closeSiteDialog() { siteDialog.value = false }
function saveSite() {
  let parsed: URL
  try { parsed = new URL(form.value.url) } catch { formError.value = '请输入有效的网址。'; return }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) { formError.value = '网址必须使用 HTTP 或 HTTPS，且不能包含账号密码。'; return }
  let iconUrl: string | undefined
  if (form.value.iconUrl) {
    try { const icon = new URL(form.value.iconUrl); if (icon.protocol !== 'https:' || icon.username || icon.password) throw new Error(); iconUrl = icon.href }
    catch { formError.value = '备用图标必须使用不含账号密码的 HTTPS 地址。'; return }
  }
  const normalizedUrl = parsed.href
  const duplicate = sites.value.find(site => site.url === normalizedUrl && site.id !== editingId.value)
  if (duplicate) { formError.value = `这个网址已在合集里：${duplicate.name}。`; return }
  if (editingId.value) {
    const target = sites.value.find(site => site.id === editingId.value)
    if (target) { target.name = form.value.name; target.url = normalizedUrl; target.brand = target.builtin && builtinSites.some(site => site.id === target.id && site.url === normalizedUrl) ? target.id : undefined; target.iconUrl = iconUrl }
  } else {
    sites.value.push({ id: `custom-${crypto.randomUUID()}`, name: form.value.name, url: normalizedUrl, iconUrl, category: 'assistant', builtin: false, visible: true })
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
function registerWebview(id: string, element: Element | null) {
  if (element instanceof HTMLElement) webviewEls.set(id, element as BrowserWebview)
  else webviewEls.delete(id)
}
function webviewRef(id: string) { return (element: Element | null) => registerWebview(id, element) }
function reloadFrame() {
  const tab = currentSite.value
  if (!tab) return
  setTabLoading(tab.id, true)
  loadError.value = ''; tab.error = undefined
  if (hostBrowserReady.value) hostBrowser?.control(tab.id, 'reload')
  else if (isElectron) {
    const webview = webviewEls.get(tab.id)
    if (!webview) { setTabLoading(tab.id, false); return }
    webview.reload()
  }
  else if (currentSite.value) {
    const frame = document.querySelector<HTMLIFrameElement>('.site-iframe')
    if (frame) frame.src = frame.src
  }
}
function goBack() { const tab = currentSite.value; if (tab && hostBrowserReady.value) hostBrowser?.control(tab.id, 'back'); else { const webview = tab && webviewEls.get(tab.id); if (webview?.canGoBack()) webview.goBack() } }
function goForward() { const tab = currentSite.value; if (tab && hostBrowserReady.value) hostBrowser?.control(tab.id, 'forward'); else { const webview = tab && webviewEls.get(tab.id); if (webview?.canGoForward()) webview.goForward() } }
function stopFrame() {
  const tab = currentSite.value
  if (!tab) return
  if (hostBrowserReady.value) hostBrowser?.control(tab.id, 'stop')
  else if (isElectron) webviewEls.get(tab.id)?.stop()
  else {
    try { document.querySelector<HTMLIFrameElement>('.site-iframe')?.contentWindow?.stop() } catch { /* Cross-origin iframe control is optional. */ }
  }
  setTabLoading(tab.id, false)
}
function tabById(id: string) { return browserTabs.value.find(tab => tab.id === id) }
function setTabLoading(id: string, value: boolean) { const tab = tabById(id); if (tab) tab.loading = value }
function tabLabel(tab: BrowserTab) {
  if (tab.pageTitle) return tab.pageTitle
  if (tab.loading) return '无标题'
  if (tab.name) return tab.name
  try { return new URL(tab.currentUrl).hostname } catch { return '无标题' }
}
function clearTitleRefresh(id: string) {
  for (const timer of titleRefreshTimers.get(id) ?? []) window.clearTimeout(timer)
  titleRefreshTimers.delete(id)
}
function syncTabTitle(id: string) {
  const tab = tabById(id), webview = webviewEls.get(id)
  if (!tab || !webview) return false
  try {
    const title = webview.getTitle().trim()
    if (!title) return false
    tab.pageTitle = title
    clearTitleRefresh(id)
    return true
  } catch { return false }
}
function refreshTabTitle(id: string) {
  clearTitleRefresh(id)
  const timers = [0, 150, 600, 1500].map(delay => window.setTimeout(() => syncTabTitle(id), delay))
  titleRefreshTimers.set(id, timers)
}
function handleLoadStart(id: string) {
  const tab = tabById(id)
  clearTitleRefresh(id)
  if (tab) { tab.loading = true; tab.pageTitle = ''; tab.faviconUrl = undefined }
}
function handleLoadFinished(id: string) {
  setTabLoading(id, false)
  refreshTabTitle(id)
}
function frameLoaded() { loadError.value = ''; if (currentSite.value) setTabLoading(currentSite.value.id, false) }
function handleNavigate(id: string, event: Event) {
  const source = event as Event & { url?: string; detail?: { url?: string } }
  const url = source.url ?? source.detail?.url
  const tab = tabById(id)
  if (url && tab) tab.currentUrl = url
  if (activeTab.value === id) loadError.value = ''
  queueMicrotask(() => syncTabHistory(id))
}
function syncTabHistory(id: string) {
  const tab = tabById(id), webview = webviewEls.get(id)
  if (!tab || !webview) return
  try { tab.canGoBack = webview.canGoBack(); tab.canGoForward = webview.canGoForward() } catch { /* The guest may have been detached. */ }
}
function handleLoadError(id: string, event: Event) {
  const source = event as Event & { errorCode?: number; errorDescription?: string; detail?: { errorCode?: number; errorDescription?: string } }
  const errorCode = source.errorCode ?? source.detail?.errorCode
  const errorDescription = source.errorDescription ?? source.detail?.errorDescription
  setTabLoading(id, false)
  if (activeTab.value === id && errorCode !== -3) loadError.value = errorDescription || '网络连接失败，请检查网络后重试。'
}
function handleTitleUpdate(id: string, event: Event) {
  const source = event as Event & { title?: string; detail?: { title?: string } }
  const title = (source.title ?? source.detail?.title)?.trim()
  const tab = tabById(id)
  if (tab && title) { tab.pageTitle = title; clearTitleRefresh(id) }
}
function handleWillNavigate(id: string, event: Event) {
  const source = event as Event & { url?: string; detail?: { url?: string } }
  const url = source.url ?? source.detail?.url
  if (!url || !tabById(id)) return
  try {
    const next = new URL(url)
    if (!['http:', 'https:'].includes(next.protocol)) { event.preventDefault(); window.open(url, '_blank', 'noopener,noreferrer') }
  } catch { event.preventDefault() }
}
function handleFaviconUpdate(id: string, event: Event) {
  const source = event as Event & { favicons?: unknown[] }
  const favicon = source.favicons?.find((icon): icon is string => {
    if (typeof icon !== 'string') return false
    try { return ['http:', 'https:'].includes(new URL(icon).protocol) } catch { return false }
  })
  const tab = tabById(id)
  if (tab && favicon) tab.faviconUrl = favicon
}
function applyTheme(theme: unknown) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
}
function syncHostBrowserLayout() {
  if (hostBrowserReady.value) hostBrowser?.layout(activeTab.value, webContent.value, Boolean(currentSite.value) && !siteDialog.value && !manageOpen.value && !loadError.value && !storageError.value && !storageLoading.value)
}
function handleHostBrowserState(state: HostBrowserState) {
  const tab = tabById(state.tabId)
  if (!tab) return
  if (state.url) tab.currentUrl = state.url
  if (state.title) tab.pageTitle = state.title
  tab.loading = state.loading
  tab.canGoBack = state.canGoBack ?? false
  tab.canGoForward = state.canGoForward ?? false
  tab.error = state.error
  if (state.faviconUrl !== undefined) tab.faviconUrl = state.faviconUrl
  if (activeTab.value === tab.id) loadError.value = state.error || ''
}
function handlePlatformMessage(event: MessageEvent) {
  if (isPlatformApp && event.source === window && event.data?.type === 'mira:workbench-browser-event' && event.data.value?.type === 'miniapp-closed') {
    const tab = miniappTabs.value.find(item => item.viewId === event.data.value.id)
    if (tab) { miniappTabs.value = miniappTabs.value.filter(item => item !== tab); if (activeTab.value === tab.id) activeTab.value = 'home'; miniappError.value = `${tab.name}已关闭。` }
    return
  }
  if (event.source !== window.parent) return
  const message = event.data as { type?: string; theme?: unknown; url?: unknown } | undefined
  if (message?.type === 'mira:theme') applyTheme(message.theme)
  if (message?.type === 'mira:workbench-open-tab' && typeof message.url === 'string') openBrowserTab(message.url)
}
function relayMiraShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.repeat || (!event.metaKey && !event.ctrlKey)) return
  window.parent.postMessage({
    type: 'mira:shortcut',
    sourceApp: 'mira-workbench',
    key: event.key,
    code: event.code,
    keyCode: event.keyCode,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    repeat: event.repeat,
    isComposing: event.isComposing,
  }, '*')
}
onMounted(() => {
  if (isPlatformApp) void initializeStorage()
  if (!isElectron && window.parent !== window) {
    hostBrowser = connectHostBrowser(() => {
      hostBrowserReady.value = true; browserConnecting.value = false
      window.clearTimeout(browserConnectTimer)
      for (const tab of browserTabs.value) hostBrowser?.open(tab.id, tab.currentUrl)
      void nextTick(syncHostBrowserLayout)
    }, handleHostBrowserState)
    browserResize = new ResizeObserver(() => { syncHostBrowserLayout(); syncMiniappLayout() })
    if (webContent.value) browserResize.observe(webContent.value)
    if (miniappStage.value) browserResize.observe(miniappStage.value)
    browserConnectTimer = window.setTimeout(() => { browserConnecting.value = false }, 1500)
  }
  window.addEventListener('message', handlePlatformMessage)
  window.addEventListener('keydown', relayMiraShortcut)
  if (!isPlatformApp) applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
})
onUnmounted(() => {
  themeUnsubscribe?.(); sdk?.dispose()
  hostBrowser?.dispose(); browserResize?.disconnect(); window.clearTimeout(browserConnectTimer)
  for (const id of titleRefreshTimers.keys()) clearTitleRefresh(id)
  window.removeEventListener('message', handlePlatformMessage)
  window.removeEventListener('keydown', relayMiraShortcut)
})
</script>
