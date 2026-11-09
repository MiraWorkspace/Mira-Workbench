<template>
  <main class="workbench" :class="{ 'workbench--browser': activeTab !== 'home' }">
    <div v-if="storageLoading || storageError" class="dialog-backdrop"><section class="site-dialog" role="alertdialog" aria-modal="true"><h2>{{ storageLoading ? '正在加载工作台' : '工作台数据不可用' }}</h2><p v-if="storageError">{{ storageError }}</p><div v-if="storageError" class="dialog-actions"><button class="add-button" type="button" @click="retryStorage">重试</button></div></section></div>
    <WorkbenchTabs :active-tab="activeTab" :browser-tabs="browserTabs" :miniapp-tabs="miniappTabs" :logo-url="logoUrl" @activate="id => id === 'home' ? activeTab = 'home' : activateTab(id)" @close-site="closeTab" @close-miniapp="closeMiniapp" @add="openAdd" @manage="manageOpen = true" />

    <WorkbenchHome v-show="activeTab === 'home'" :entries="gridEntries" :opening-miniapp="openingMiniapp" :error="miniappError" :notice="miniappNotice" @open="entry => entry.type === 'website' ? openSite(entry.item) : openMiniapp(entry.item)" @hide="hideEntry" @pin="togglePin" @edit="editEntry" @delete="deleteEntry" @add="openAdd" />

    <section v-if="browserTabs.length" v-show="Boolean(currentSite)" class="browser-view">
      <BrowserToolbar ref="browserToolbar" v-model:address="addressDraft" :loading="pageLoading" :can-go-back="currentSite?.canGoBack ?? false" :can-go-forward="currentSite?.canGoForward ?? false" @editing="addressEditing = $event" @navigate="navigateAddress" @reset="addressDraft = currentAddress; browserToolbar?.resetValidity()" @back="goBack" @forward="goForward" @stop="stopFrame" @reload="reloadFrame" @external="openExternal" />
      <p v-if="externalError" class="external-error" role="alert">{{ externalError }}</p>
      <div ref="webContent" class="web-content">
        <template v-if="isElectron">
          <webview v-for="tab in browserTabs" :key="tab.id" :ref="webviewRef(tab.id)" v-show="activeTab === tab.id" class="site-webview" :src="tab.currentUrl" partition="persist:mira-workbench" webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes,webSecurity=yes" allowpopups @did-start-loading="handleLoadStart(tab.id)" @did-stop-loading="handleLoadFinished(tab.id)" @did-navigate="handleNavigate(tab.id, $event)" @did-navigate-in-page="handleNavigate(tab.id, $event)" @page-title-updated="handleTitleUpdate(tab.id, $event)" @page-favicon-updated="handleFaviconUpdate(tab.id, $event)" @did-fail-load="handleLoadError(tab.id, $event)" @will-navigate="handleWillNavigate(tab.id, $event)" />
        </template>
        <iframe v-else-if="currentSite && !hostBrowserReady && !browserConnecting" :key="currentSite.id" class="site-iframe" :src="currentSite.currentUrl" :title="`${currentSite.name} 网页`" referrerpolicy="no-referrer" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock allow-presentation" @load="frameLoaded" />
        <div v-if="loadError && currentSite" class="embed-warning"><div class="warning-icon"><TriangleAlert :size="22" /></div><h2>{{ currentSite.name }}暂时无法在工作台显示</h2><p>{{ loadError }}</p><button class="add-button" type="button" @click="openExternal"><ExternalLink :size="15" />在系统浏览器打开</button><button class="text-button" type="button" @click="reloadFrame">重试嵌入</button></div>
      </div>
    </section>
    <section v-if="miniappTabs.length" v-show="Boolean(currentMiniapp)" ref="miniappStage" class="browser-view" />

    <SiteDialog v-if="siteDialog" :site="editingSite" :sites="sites" :load-icon="loadSiteIcon" :is-platform-app="isPlatformApp" :managing-miniapp="managingMiniapp" :miniapp-error="miniappError" :miniapp-notice="miniappNotice" @close="closeSiteDialog" @save="saveSite" @delete="deleteSite" @select-miniapp="selectMiniapp" />

    <div v-if="editingMiniapp" class="dialog-backdrop dialog-backdrop--floating" @click.self="editingMiniapp = ''" @keydown.esc.stop="editingMiniapp = ''"><section class="site-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-miniapp-title"><div class="dialog-heading"><h2 id="edit-miniapp-title">编辑小程序</h2><button class="icon-button" type="button" aria-label="关闭" @click="editingMiniapp = ''"><X :size="17" /></button></div><form @submit.prevent="saveMiniappName"><label><span>显示名称</span><input v-model.trim="miniappName" maxlength="40" required /></label><div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="editingMiniapp = ''">取消</button><button class="add-button" type="submit" :disabled="!miniappName">保存</button></div></form></section></div>
    <ManageDialog v-if="manageOpen" :sites="sites" :miniapps="miniapps" :entries="otherEntries" :busy="managingMiniapp" :error="miniappError" @close="manageOpen = false" @edit="site => { manageOpen = false; editSite(site) }" @site-visible="(site, visible) => site.visible = visible" @permissions="openPermissions" @revoke="item => manageMiniapp(item, 'revoke')" @uninstall="item => manageMiniapp(item, 'uninstall')" @miniapp-visible="setMiniappVisible" @restore="restoreDefaults" @done="saveSites(); manageOpen = false" />

    <PermissionsDialog v-if="permissionItem" v-model:draft="permissionDraft" :item="permissionItem" :busy="managingMiniapp" :error="miniappError" @close="permissionsId = ''" @save="savePermissions" @revoke="manageMiniapp(permissionItem, 'revoke')" @remove-directory="id => miniappAction(() => miniappManager!.removeDirectory(permissionsId, id))" @add-directory="access => miniappAction(() => miniappManager!.addDirectory(permissionsId, access))" />
    <PermissionReviewDialog v-if="permissionReview" :review="permissionReview" @finish="finishReview" />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ExternalLink, TriangleAlert, X } from 'lucide-vue-next'
import WorkbenchHome from './components/WorkbenchHome.vue'
import WorkbenchTabs from './components/WorkbenchTabs.vue'
import ManageDialog from './components/ManageDialog.vue'
import BrowserToolbar from './components/BrowserToolbar.vue'
import SiteDialog from './components/SiteDialog.vue'
import PermissionsDialog from './components/PermissionsDialog.vue'
import PermissionReviewDialog from './components/PermissionReviewDialog.vue'
import { useBrowserTabs } from './composables/useBrowserTabs'
import type { GridEntry } from './types'
import { builtinSites, readSites, sitesStorageKey, type WebsiteEntry } from './data/sites'
import { connectHostBrowser, connectPlatformBrowser } from './hostBrowser'
import { WorkbenchStore, type WorkbenchEntry } from './data/workbenchStore'
import { MiniappManager, type InstalledMiniapp, type ReviewRequest } from './miniapps/manager'
import type { MiniappCapability } from './miniapps/package'
import { connectMiraApp, type MiraAppSdk } from '@mira/app-sdk'

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
let miniappManager: MiniappManager | undefined
const permissionReview = ref<ReviewRequest>()
let resolveReview: ((approved: boolean) => void) | undefined
const permissionsId = ref('')
const permissionDraft = ref<MiniappCapability[]>([])
const permissionItem = computed(() => miniapps.value.find(item => item.id === permissionsId.value))
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
const activeTab = ref('home')
const { browserTabs, currentSite, currentAddress, browserToolbar, addressDraft, addressEditing, pageLoading, loadError, externalError, openSite, openBrowserTab, activateTab, closeTab, navigateAddress, openExternal, webviewRef, reloadFrame, goBack, goForward, stopFrame, handleLoadStart, handleLoadFinished, frameLoaded, handleNavigate, handleLoadError, handleTitleUpdate, handleWillNavigate, handleFaviconUpdate, handleHostBrowserState } = useBrowserTabs({ activeTab, hostBrowserReady, getHostBrowser: () => hostBrowser, getSdk: () => sdk, isElectron, isPlatformApp })
const siteDialog = ref(false)
let dialogTrigger: HTMLElement | null = null
const manageOpen = ref(false)
const editingId = ref('')
const editingMiniapp = ref('')
const miniappName = ref('')
const gridEntries = computed<GridEntry[]>(() => {
  return [
    ...sites.value.filter(site => site.visible).map(item => ({ type: 'website' as const, item, name: item.name, builtin: item.builtin, pinned: !!item.pinned })),
    ...miniapps.value.filter(item => miniappVisible(item.id)).map(item => { const saved = miniappEntry(item.id); return { type: 'miniapp' as const, item, name: saved?.name || item.name, builtin: saved?.builtin ?? false, pinned: !!saved?.pinned } }),
  ]
})
const currentMiniapp = computed(() => miniappTabs.value.find(tab => tab.id === activeTab.value))
const editingSite = computed(() => sites.value.find(site => site.id === editingId.value))
const attemptedIcons = new Set<string>()
watch(sites, () => { if (initialized || !isPlatformApp) saveSites() }, { deep: true, flush: 'sync' })
watch(sites, () => { if (initialized || !isPlatformApp) cacheSiteIcons() }, { deep: true })
watch([activeTab, siteDialog, manageOpen, loadError, hostBrowserReady, storageError, storageLoading, permissionReview, permissionsId], () => { void nextTick(() => { syncHostBrowserLayout(); syncMiniappLayout() }) })
watch(miniappStage, (element, previous) => { if (previous) browserResize?.unobserve(previous); if (element) browserResize?.observe(element); syncMiniappLayout() })
watch(webContent, (element, previous) => { if (previous) browserResize?.unobserve(previous); if (element) browserResize?.observe(element); syncHostBrowserLayout() })
function siteToEntry(site: WebsiteEntry): WorkbenchEntry { return { id: site.id, type: 'website', name: site.name, address: site.url, icon: site.iconUrl || site.brand, cachedIcon: site.cachedIcon, category: site.category, builtin: site.builtin, visible: site.visible, pinned: site.pinned } }
function entryToSite(entry: WorkbenchEntry): WebsiteEntry { const iconUrl = entry.icon && /^(https:\/\/|data:image\/)/.test(entry.icon) ? entry.icon : undefined; const builtin = entry.builtin ? builtinSites.find(site => site.id === entry.id && site.url === entry.address) : undefined; return { id: entry.id, name: entry.name, url: entry.address, category: entry.category === 'search' ? 'search' : 'assistant', brand: builtin?.id, iconUrl, cachedIcon: entry.cachedIcon, builtin: entry.builtin, visible: entry.visible, pinned: entry.pinned } }
function cacheSiteIcons() {
  for (const site of sites.value) {
    const url = site.url, key = `${site.id}:${url}`
    if (site.iconUrl || site.cachedIcon || site.brand || attemptedIcons.has(key)) continue
    attemptedIcons.add(key)
    void loadSiteIcon(url).then(icon => {
      if (!icon || !sites.value.includes(site) || site.url !== url || site.iconUrl) return
      site.cachedIcon = icon
      for (const tab of browserTabs.value) if (tab.id === site.id && tab.url === url) tab.cachedIcon = icon
    }).catch(() => { /* Keep the default icon when acquisition or decoding fails. */ })
  }
}
async function loadSiteIcon(url: string): Promise<string | undefined> {
  let source: string | null
  if (sdk) source = await sdk.workbench.fetchSiteIcon(url)
  else {
    const response = await fetch(new URL('/favicon.ico', url), { signal: AbortSignal.timeout(8000), credentials: 'omit' })
    if (!response.ok) return
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') || blob.size > 512 * 1024) return
    source = URL.createObjectURL(blob)
  }
  if (!source) return
  try {
    const image = new Image(); image.src = source; await image.decode()
    const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally { if (source.startsWith('blob:')) URL.revokeObjectURL(source) }
}
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
    cacheSiteIcons()
    if (!miniappManager) {
      miniappManager = new MiniappManager(sdk, request => new Promise(resolve => { permissionReview.value = request; resolveReview = resolve }), items => {
        miniapps.value = items
        const added = items.filter(item => !otherEntries.value.some(entry => entry.type === 'miniapp' && entry.address === item.id))
        if (added.length) { otherEntries.value.push(...added.map(item => ({ id: `miniapp:${item.id}`, type: 'miniapp' as const, name: item.name, address: item.id, builtin: false, visible: true }))); saveSites() }
      }, viewId => {
        const tab = miniappTabs.value.find(tab => tab.viewId === viewId)
        if (tab) { miniappTabs.value = miniappTabs.value.filter(item => item !== tab); if (activeTab.value === tab.id) activeTab.value = 'home' }
      })
    }
    try { await miniappManager.initialize() }
    catch (error) { miniappError.value = `${error instanceof Error ? error.message : '读取小程序失败'}，请修复后重新加载 Workbench。` }
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
function finishReview(approved: boolean) { permissionReview.value = undefined; resolveReview?.(approved); resolveReview = undefined }
async function selectMiniapp(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''
  if (!file || !miniappManager || managingMiniapp.value) return
  managingMiniapp.value = true; miniappError.value = ''; miniappNotice.value = ''
  try {
    if (file.size > 64 * 1024 * 1024) throw new Error('安装包不能超过 64 MB')
    if (await miniappManager.install(new Uint8Array(await file.arrayBuffer()))) miniappNotice.value = '小程序已安装或更新，可以立即打开。'
  } catch (error) { miniappError.value = error instanceof Error ? error.message : '安装失败' }
  finally { managingMiniapp.value = false }
}
async function manageMiniapp(item: InstalledMiniapp, action: 'uninstall' | 'revoke') {
  if (!miniappManager || managingMiniapp.value) return
  managingMiniapp.value = true; miniappError.value = ''; miniappNotice.value = ''
  try {
    if (action === 'uninstall') { if (await miniappManager.uninstall(item.id)) { miniappNotice.value = '小程序已卸载，独立数据已保留。'; if (permissionsId.value === item.id) permissionsId.value = '' } }
    else { await miniappManager.revoke(item.id); permissionDraft.value = [] }
  } catch (error) { miniappError.value = error instanceof Error ? error.message : '操作失败' }
  finally { managingMiniapp.value = false }
}
function openPermissions(item: InstalledMiniapp) { permissionsId.value = item.id; permissionDraft.value = [...item.approved] }
async function savePermissions(permissions: MiniappCapability[]) {
  if (!miniappManager || !permissionItem.value) return
  await miniappAction(() => miniappManager!.setPermissions(permissionsId.value, permissions))
}
async function miniappAction(action: () => Promise<unknown>) {
  if (managingMiniapp.value) return
  managingMiniapp.value = true; miniappError.value = ''
  try { await action() } catch (error) { miniappError.value = error instanceof Error ? error.message : '操作失败' }
  finally { managingMiniapp.value = false }
}
function miniappEntry(id: string) { return otherEntries.value.find(entry => entry.type === 'miniapp' && entry.address === id) }
function miniappVisible(id: string) { return miniappEntry(id)?.visible !== false }
function setMiniappVisible(id: string, visible: boolean) {
  const entry = otherEntries.value.find(item => item.type === 'miniapp' && item.address === id)
  if (entry) { entry.visible = visible; saveSites() }
}
function hideEntry(entry: GridEntry) {
  if (entry.type === 'website') entry.item.visible = false
  else setMiniappVisible(entry.item.id, false)
}
function togglePin(entry: GridEntry) {
  if (entry.type === 'website') entry.item.pinned = !entry.pinned
  else { const saved = miniappEntry(entry.item.id); if (saved) { saved.pinned = !entry.pinned; saveSites() } }
}
function editEntry(entry: GridEntry) {
  if (entry.type === 'website') editSite(entry.item)
  else { editingMiniapp.value = entry.item.id; miniappName.value = entry.name }
}
function saveMiniappName() {
  const entry = miniappEntry(editingMiniapp.value)
  if (entry && miniappName.value) { entry.name = miniappName.value; saveSites(); editingMiniapp.value = '' }
}
function deleteEntry(entry: GridEntry) {
  if (entry.type === 'website') { editingId.value = entry.item.id; deleteSite() }
  else void manageMiniapp(entry.item, 'uninstall')
}
async function openMiniapp(item: InstalledMiniapp) {
  if (!miniappManager || openingMiniapp.value) return
  const existing = miniappTabs.value.find(tab => tab.id === `miniapp:${item.id}`)
  if (existing) { activateTab(existing.id); return }
  openingMiniapp.value = true; miniappError.value = ''
  try {
    const viewId = await miniappManager.open(item.id)
    if (viewId === undefined) return
    if (typeof viewId !== 'number') throw new Error('小程序打开失败')
    const tab = { id: `miniapp:${item.id}`, name: item.name, viewId }
    miniappTabs.value.push(tab); activeTab.value = tab.id
    await nextTick(); syncMiniappLayout()
  } catch (error) { miniappError.value = error instanceof Error ? error.message : '小程序打开失败' }
  finally { openingMiniapp.value = false }
}
function syncMiniappLayout() {
  if (!sdk) return
  const bounds = miniappStage.value?.getBoundingClientRect()
  for (const tab of miniappTabs.value) void sdk.views.control({ type: 'layout', id: tab.viewId, visible: tab.id === activeTab.value && !siteDialog.value && !manageOpen.value && !storageError.value && !storageLoading.value && !permissionReview.value && !permissionsId.value && Boolean(bounds?.width && bounds.height), bounds: bounds ? { x: Math.max(0, bounds.x), y: Math.max(0, bounds.y), width: bounds.width, height: bounds.height } : { x: 0, y: 0, width: 0, height: 0 } }).catch(() => undefined)
}
function closeMiniapp(id: string) {
  const index = miniappTabs.value.findIndex(tab => tab.id === id)
  if (index < 0) return
  const [tab] = miniappTabs.value.splice(index, 1)
  void miniappManager?.close(tab.viewId).catch(() => undefined)
  if (activeTab.value === id) activeTab.value = 'home'
}
function openAdd() { editingId.value = ''; showSiteDialog() }
function editSite(site: WebsiteEntry) { editingId.value = site.id; showSiteDialog() }
function showSiteDialog() { dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; siteDialog.value = true }
function closeSiteDialog() { siteDialog.value = false; dialogTrigger?.focus() }
function saveSite(value: { name: string; url: string; iconUrl?: string; cachedIcon?: string }) {
  const target = sites.value.find(site => site.id === editingId.value)
  if (target) { Object.assign(target, value); target.brand = target.builtin && builtinSites.some(site => site.id === target.id && site.url === value.url) ? target.id : undefined }
  else sites.value.push({ id: 'custom-' + crypto.randomUUID(), ...value, category: 'assistant', builtin: false, visible: true })
  saveSites(); closeSiteDialog()
}
function deleteSite(site?: WebsiteEntry) {
  const id = site?.id ?? editingId.value
  const index = sites.value.findIndex(item => item.id === id && !item.builtin)
  if (index >= 0) sites.value.splice(index, 1)
  closeSiteDialog()
}
function restoreDefaults() { sites.value = structuredClone(builtinSites) }
function applyTheme(theme: unknown) {
  if (theme === 'light' || theme === 'dark') { document.documentElement.dataset.theme = theme; miniappManager?.themeChanged(theme) }
}
function syncHostBrowserLayout() {
  if (hostBrowserReady.value) hostBrowser?.layout(activeTab.value, webContent.value, Boolean(currentSite.value) && !siteDialog.value && !manageOpen.value && !loadError.value && !storageError.value && !storageLoading.value && !permissionReview.value && !permissionsId.value)
}
function handlePlatformMessage(event: MessageEvent) {
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
  else cacheSiteIcons()
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
  finishReview(false); themeUnsubscribe?.(); void miniappManager?.dispose().finally(() => sdk?.dispose())
  hostBrowser?.dispose(); browserResize?.disconnect(); window.clearTimeout(browserConnectTimer)
  window.removeEventListener('message', handlePlatformMessage)
  window.removeEventListener('keydown', relayMiraShortcut)
})
</script>
