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
      <div class="topbar-actions"><button class="icon-button" type="button" aria-label="新增" data-tooltip="新增" @click="openAdd"><Plus :size="17" /></button><button class="icon-button" type="button" aria-label="设置" data-tooltip="设置" @click="manageOpen = true"><SlidersHorizontal :size="17" /></button></div>
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
      <section ref="siteDialogElement" class="site-dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="site-dialog-title" tabindex="-1" @keydown.tab="trapDialogFocus">
        <div class="dialog-heading"><h2 id="site-dialog-title">{{ editingId ? '编辑网站' : '新增' }}</h2><button class="icon-button" type="button" aria-label="关闭" @click="closeSiteDialog"><X :size="17" /></button></div>
        <div v-if="!editingId" class="add-tabs" role="tablist" aria-label="新增类型">
          <button id="add-website-tab" type="button" role="tab" :aria-selected="addType === 'website'" aria-controls="add-website-panel" :tabindex="addType === 'website' ? 0 : -1" @click="addType = 'website'" @keydown.right.prevent="selectAddType('miniapp')" @keydown.left.prevent="selectAddType('miniapp')"><Globe :size="17" />网站</button>
          <button id="add-miniapp-tab" type="button" role="tab" :aria-selected="addType === 'miniapp'" aria-controls="add-miniapp-panel" :tabindex="addType === 'miniapp' ? 0 : -1" @click="addType = 'miniapp'" @keydown.right.prevent="selectAddType('website')" @keydown.left.prevent="selectAddType('website')"><Package :size="17" />本地小程序</button>
        </div>
        <form v-show="addType === 'website'" id="add-website-panel" :role="editingId ? undefined : 'tabpanel'" :aria-labelledby="editingId ? undefined : 'add-website-tab'" @submit.prevent="saveSite">
          <div class="logo-upload">
            <span class="site-icon logo-preview"><LayoutGrid v-if="!form.name && !form.url && !form.iconUrl" :size="36" class="logo-placeholder" /><BrandMark v-else :brand="editingBrand" :name="form.name" :url="form.url" :custom-icon="form.iconUrl" /></span>
            <input ref="logoInput" class="logo-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" aria-label="选择 Logo 文件" @change="uploadLogo" />
            <div class="logo-upload-actions"><button class="cancel-button" type="button" :disabled="uploadingLogo" @click="logoInput?.click()"><Upload :size="15" />{{ uploadingLogo ? '正在处理…' : '上传 Logo 文件' }}</button><button v-if="form.iconUrl" class="text-button" type="button" :disabled="uploadingLogo" @click="form.iconUrl = ''">恢复默认图标</button></div>
            <p class="logo-hint">支持常见图片格式，最大 5 MB</p>
          </div>
          <label><span>网站名称 <span class="required-mark">*</span></span><input v-model.trim="form.name" maxlength="40" placeholder="请输入名称" required /></label>
          <label><span>网站地址 <span class="required-mark">*</span></span><input v-model.trim="form.url" type="url" placeholder="https://example.com" required /></label>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
          <div class="dialog-actions"><button v-if="editingId && !editingIsBuiltin" class="delete-button" type="button" @click="deleteSite">删除网站</button><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="closeSiteDialog">取消</button><button class="add-button" type="submit" :disabled="uploadingLogo || !form.name || !form.url"><Check :size="15" />保存</button></div>
        </form>
        <div v-if="addType === 'miniapp'" id="add-miniapp-panel" role="tabpanel" aria-labelledby="add-miniapp-tab">
          <p class="miniapp-info"><Package :size="20" /><span>安装授权后可以调用本地能力</span></p>
          <input ref="miniappInput" class="logo-file-input" type="file" accept=".miniapp,.zip" aria-label="选择小程序安装包" @change="selectMiniapp" /><div class="miniapp-upload"><p>选择一个 .miniapp 或 .zip 安装包，安装前会展示它申请的权限。</p><button class="cancel-button" type="button" :disabled="!isPlatformApp || managingMiniapp" @click="installMiniapp"><Upload :size="15" />{{ managingMiniapp ? '正在安装…' : '选择文件…' }}</button><p v-if="!isPlatformApp" class="miniapp-unavailable">请在 Mira 桌面应用中安装本地小程序。</p></div>
          <p v-if="miniappError" class="form-error" role="alert">{{ miniappError }}</p><p v-if="miniappNotice" class="miniapp-notice" role="status">{{ miniappNotice }}</p>
          <div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="closeSiteDialog">{{ miniappNotice ? '完成' : '取消' }}</button></div>
        </div>
      </section>
    </div>

    <div v-if="manageOpen" class="dialog-backdrop" @click.self="manageOpen = false" @keydown.esc.stop="manageOpen = false"><section class="manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-title"><div class="dialog-heading"><div><p class="eyebrow">COLLECTION SETTINGS</p><h2 id="manage-title">显示管理</h2></div><button class="icon-button" type="button" aria-label="关闭" @click="manageOpen = false"><X :size="17" /></button></div><p class="manage-copy">选择要显示的网站和小程序。</p><div class="manage-list"><div v-for="site in sites" :key="site.id" class="manage-item"><BrandMark :brand="site.brand" :name="site.name" :url="site.url" :custom-icon="site.iconUrl" /><span>{{ site.name }}</span><button class="text-button manage-edit" type="button" :aria-label="`编辑 ${site.name}`" @click="manageOpen = false; editSite(site)">编辑</button><input v-model="site.visible" type="checkbox" :aria-label="`显示 ${site.name}`" /></div><div v-for="item in miniapps" :key="item.id" class="manage-item"><span>{{ item.name.slice(0, 1) }}</span><span>{{ item.name }}</span><button class="text-button manage-edit" type="button" @click="openPermissions(item)">权限</button><button v-if="item.reviewed" class="text-button" type="button" :disabled="managingMiniapp" @click="manageMiniapp(item, 'revoke')">撤销权限</button><button class="text-button" type="button" :disabled="managingMiniapp" @click="manageMiniapp(item, 'uninstall')">卸载</button><input type="checkbox" :aria-label="`显示 ${item.name}`" :checked="miniappVisible(item.id)" @change="setMiniappVisible(item.id, ($event.target as HTMLInputElement).checked)" /></div></div><p v-if="miniappError" role="alert">{{ miniappError }}</p><div class="dialog-actions"><button class="text-button" type="button" @click="restoreDefaults">恢复默认列表</button><span class="dialog-spacer"></span><button class="add-button" type="button" @click="saveSites(); manageOpen = false"><Check :size="15" />完成</button></div></section></div>

    <div v-if="permissionItem" class="dialog-backdrop" @click.self="permissionsId = ''" @keydown.esc.stop="permissionsId = ''"><section class="site-dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="permissions-title">
      <div class="dialog-heading"><h2 id="permissions-title">{{ permissionItem.name }} · 权限</h2><button class="icon-button" type="button" aria-label="关闭权限设置" @click="permissionsId = ''"><X :size="17" /></button></div>
      <p class="manage-copy">版本 {{ permissionItem.manifest.version }}。修改权限会关闭正在运行的小程序。</p>
      <div class="permission-list"><label v-for="cap in permissionItem.manifest.requiredCapabilities" :key="cap"><input v-model="permissionDraft" type="checkbox" :value="cap" :disabled="managingMiniapp" />{{ capabilityLabels[cap] }}</label><p v-if="!permissionItem.manifest.requiredCapabilities.length">此小程序未申请额外能力。</p></div>
      <div class="dialog-actions"><button class="add-button" type="button" :disabled="managingMiniapp" @click="savePermissions">保存权限</button><button class="text-button" type="button" :disabled="managingMiniapp" @click="manageMiniapp(permissionItem, 'revoke')">撤销全部权限</button></div>
      <h3 class="directory-heading">授权目录</h3><p class="manage-copy">仅可访问在此授权的目录，可分别授予只读或读写权限。</p>
      <div v-for="grant in permissionItem.directories" :key="grant.id" class="directory-item"><span>{{ grant.name }} · {{ grant.access === 'read' ? '只读' : '读写' }}</span><button class="text-button" type="button" :disabled="managingMiniapp" @click="miniappAction(() => miniappManager!.removeDirectory(permissionsId, grant.id))">撤销目录授权</button></div>
      <div class="dialog-actions"><button class="cancel-button" type="button" :disabled="managingMiniapp || !permissionItem.approved.includes('files:read')" @click="miniappAction(() => miniappManager!.addDirectory(permissionsId, 'read'))">添加只读目录</button><button class="cancel-button" type="button" :disabled="managingMiniapp || !permissionItem.approved.includes('files:read') || !permissionItem.approved.includes('files:write')" @click="miniappAction(() => miniappManager!.addDirectory(permissionsId, 'readwrite'))">添加读写目录</button></div>
      <p v-if="miniappError" class="form-error" role="alert">{{ miniappError }}</p><div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="permissionsId = ''">完成</button></div>
    </section></div>
    <div v-if="permissionReview" class="dialog-backdrop" @keydown.esc.stop="finishReview(false)"><section class="site-dialog add-dialog review-dialog" role="alertdialog" aria-modal="true" aria-labelledby="review-title" tabindex="-1" @keydown.tab="trapReviewFocus">
      <h2 id="review-title">{{ permissionReview.title }}</h2><p>{{ permissionReview.message }}</p>
      <template v-if="permissionReview.permissions"><p class="manage-copy">此小程序申请以下能力：</p><ul class="permission-summary"><li v-for="permission in permissionReview.permissions" :key="permission">{{ permission }}</li><li v-if="!permissionReview.permissions.length">未申请额外能力</li></ul></template>
      <div class="dialog-actions"><span class="dialog-spacer"></span><button class="cancel-button" type="button" @click="finishReview(false)">取消</button><button class="add-button" type="button" @click="finishReview(true)">{{ permissionReview.confirm }}</button></div>
    </section></div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, ExternalLink, Globe, LayoutGrid, LoaderCircle, LockKeyhole, Package, Plus, RotateCw, Search, SlidersHorizontal, TriangleAlert, Upload, X } from 'lucide-vue-next'
import BrandMark from './components/BrandMark.vue'
import { builtinSites, readSites, sitesStorageKey, type WebsiteEntry } from './data/sites'
import { connectHostBrowser, connectPlatformBrowser, type HostBrowserState } from './hostBrowser'
import { WorkbenchStore, type WorkbenchEntry } from './data/workbenchStore'
import { MiniappManager, type InstalledMiniapp, type ReviewRequest } from './miniapps/manager'
import { capabilityLabels, type MiniappCapability } from './miniapps/package'
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
let miniappManager: MiniappManager | undefined
const miniappInput = ref<HTMLInputElement>()
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
const browserTabs = ref<BrowserTab[]>([])
const activeTab = ref('home')
const query = ref('')
const siteDialog = ref(false)
const siteDialogElement = ref<HTMLElement>()
const addType = ref<'website' | 'miniapp'>('website')
const logoInput = ref<HTMLInputElement>()
const uploadingLogo = ref(false)
let dialogTrigger: HTMLElement | null = null
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
const editingBrand = computed(() => sites.value.find(site => site.id === editingId.value)?.brand)
watch(sites, () => { if (initialized || !isPlatformApp) saveSites() }, { deep: true, flush: 'sync' })
watch([activeTab, siteDialog, manageOpen, loadError, hostBrowserReady, storageError, storageLoading, permissionReview, permissionsId], () => { void nextTick(() => { syncHostBrowserLayout(); syncMiniappLayout() }) })
watch(miniappStage, (element, previous) => { if (previous) browserResize?.unobserve(previous); if (element) browserResize?.observe(element); syncMiniappLayout() })
watch(webContent, (element, previous) => { if (previous) browserResize?.unobserve(previous); if (element) browserResize?.observe(element); syncHostBrowserLayout() })
function siteToEntry(site: WebsiteEntry): WorkbenchEntry { return { id: site.id, type: 'website', name: site.name, address: site.url, icon: site.iconUrl || site.brand, category: site.category, builtin: site.builtin, visible: site.visible } }
function entryToSite(entry: WorkbenchEntry): WebsiteEntry { const iconUrl = entry.icon && /^(https:\/\/|data:image\/)/.test(entry.icon) ? entry.icon : undefined; const builtin = entry.builtin ? builtinSites.find(site => site.id === entry.id && site.url === entry.address) : undefined; return { id: entry.id, name: entry.name, url: entry.address, category: entry.category === 'search' ? 'search' : 'assistant', brand: builtin?.id, iconUrl, builtin: entry.builtin, visible: entry.visible } }
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
    if (!miniappManager) {
      miniappManager = new MiniappManager(sdk, request => new Promise(resolve => { permissionReview.value = request; resolveReview = resolve; void nextTick(() => document.querySelector<HTMLElement>('.review-dialog')?.focus()) }), items => {
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
function installMiniapp() { miniappInput.value?.click() }
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
async function savePermissions() {
  if (!miniappManager || !permissionItem.value) return
  await miniappAction(() => miniappManager!.setPermissions(permissionsId.value, permissionDraft.value))
}
async function miniappAction(action: () => Promise<unknown>) {
  if (managingMiniapp.value) return
  managingMiniapp.value = true; miniappError.value = ''
  try { await action() } catch (error) { miniappError.value = error instanceof Error ? error.message : '操作失败' }
  finally { managingMiniapp.value = false }
}
function miniappVisible(id: string) { return otherEntries.value.find(entry => entry.type === 'miniapp' && entry.address === id)?.visible !== false }
function setMiniappVisible(id: string, visible: boolean) {
  const entry = otherEntries.value.find(item => item.type === 'miniapp' && item.address === id)
  if (entry) { entry.visible = visible; saveSites() }
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
  addType.value = 'website'
  form.value = { name: '', url: '', iconUrl: '' }
  formError.value = ''
  showSiteDialog()
}
function editSite(site: WebsiteEntry) {
  editingId.value = site.id
  addType.value = 'website'
  form.value = { name: site.name, url: site.url, iconUrl: site.iconUrl || '' }
  formError.value = ''
  showSiteDialog()
}
function showSiteDialog() {
  dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  siteDialog.value = true
  void nextTick(() => siteDialogElement.value?.focus())
}
function closeSiteDialog() { siteDialog.value = false; dialogTrigger?.focus() }
function selectAddType(type: 'website' | 'miniapp') { addType.value = type; void nextTick(() => document.getElementById(`add-${type}-tab`)?.focus()) }
function trapReviewFocus(event: KeyboardEvent) {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.review-dialog button')
  if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement?.classList.contains('review-dialog'))) { event.preventDefault(); buttons[buttons.length - 1]?.focus() }
  else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus() }
}
function trapDialogFocus(event: KeyboardEvent) {
  const controls = [...(siteDialogElement.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])].filter(element => element.offsetParent !== null && element.tabIndex >= 0)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && (document.activeElement === first || document.activeElement === siteDialogElement.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  formError.value = ''
  if (!file.type.startsWith('image/')) { formError.value = '请选择图片文件。'; return }
  if (file.size > 5 * 1024 * 1024) { formError.value = 'Logo 文件不能超过 5 MB，请选择较小的图片。'; return }
  uploadingLogo.value = true
  const draft = form.value
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    draft.iconUrl = canvas.toDataURL('image/png')
  } catch { if (form.value === draft) formError.value = '无法读取这张图片，请选择其他 Logo 文件。' }
  finally { URL.revokeObjectURL(objectUrl); uploadingLogo.value = false }
}
function saveSite() {
  if (uploadingLogo.value || !form.value.name) return
  let parsed: URL
  try { parsed = new URL(form.value.url) } catch { formError.value = '请输入有效的网址。'; return }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) { formError.value = '网址必须使用 HTTP 或 HTTPS，且不能包含账号密码。'; return }
  let iconUrl: string | undefined
  if (form.value.iconUrl) {
    try { const icon = new URL(form.value.iconUrl); if (!(icon.protocol === 'https:' || /^data:image\/png;base64,/.test(form.value.iconUrl)) || icon.username || icon.password) throw new Error(); iconUrl = icon.href }
    catch { formError.value = 'Logo 无效，请重新上传图片。'; return }
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
  closeSiteDialog()
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
  if (theme === 'light' || theme === 'dark') { document.documentElement.dataset.theme = theme; miniappManager?.themeChanged(theme) }
}
function syncHostBrowserLayout() {
  if (hostBrowserReady.value) hostBrowser?.layout(activeTab.value, webContent.value, Boolean(currentSite.value) && !siteDialog.value && !manageOpen.value && !loadError.value && !storageError.value && !storageLoading.value && !permissionReview.value && !permissionsId.value)
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
  finishReview(false); themeUnsubscribe?.(); void miniappManager?.dispose().finally(() => sdk?.dispose())
  hostBrowser?.dispose(); browserResize?.disconnect(); window.clearTimeout(browserConnectTimer)
  for (const id of titleRefreshTimers.keys()) clearTitleRefresh(id)
  window.removeEventListener('message', handlePlatformMessage)
  window.removeEventListener('keydown', relayMiraShortcut)
})
</script>
