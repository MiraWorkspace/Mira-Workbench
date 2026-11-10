import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import type { MiraAppSdk } from '@mira/app-sdk'
import type BrowserToolbar from '../components/BrowserToolbar.vue'
import type { WebsiteEntry } from '../data/sites'
import type { BrowserTab } from '../types'
import type { connectHostBrowser, HostBrowserState } from '../hostBrowser'

type BrowserWebview = HTMLElement & { reload: () => void; stop: () => void; setAudioMuted: (muted: boolean) => void; getTitle: () => string; canGoBack: () => boolean; canGoForward: () => boolean; goBack: () => void; goForward: () => void }

export function useBrowserTabs(options: { activeTab: Ref<string>; hostBrowserReady: Ref<boolean>; getHostBrowser: () => ReturnType<typeof connectHostBrowser> | undefined; getSdk: () => MiraAppSdk | undefined; isElectron: boolean; isPlatformApp: boolean }) {
  const { activeTab, hostBrowserReady, isElectron, isPlatformApp } = options
  const browserTabs = ref<BrowserTab[]>([])
  const currentSite = computed(() => browserTabs.value.find(tab => tab.id === activeTab.value))
  const currentAddress = computed(() => currentSite.value?.currentUrl || '')
  const browserToolbar = ref<InstanceType<typeof BrowserToolbar>>()
  const addressDraft = ref(''), addressEditing = ref(false)
  const pageLoading = computed(() => currentSite.value?.loading ?? false)
  const loadError = ref(''), externalError = ref('')
  const webviewEls = new Map<string, BrowserWebview>()
  const mutedOrigins = new Set<string>()
  const titleRefreshTimers = new Map<string, number[]>()
  watch([activeTab, currentAddress], ([tab, url], [previousTab]) => {
  if (tab !== previousTab) addressEditing.value = false
  if (!addressEditing.value) { addressDraft.value = url; browserToolbar.value?.resetValidity() }
})
function openSite(site: WebsiteEntry) {
  const tab = browserTabs.value.find(item => (item.sourceId || item.id) === site.id)
  if (tab) { activateTab(tab.id); return }
  openBrowserTab(site.url, site)
}
function openBrowserTab(value: string, site?: WebsiteEntry) {
  let url: URL
  try { url = new URL(value) } catch { return }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
  const muted = mutedOrigins.has(url.origin)
  const tab: BrowserTab = site
    ? { ...site, currentUrl: url.href, loading: true, pageTitle: '', canGoBack: false, canGoForward: false }
    : { id: `browser-${crypto.randomUUID()}`, name: '', url: url.href, currentUrl: url.href, category: 'assistant', builtin: false, visible: true, loading: true, pageTitle: '', canGoBack: false, canGoForward: false }
  tab.muted = muted; tab.detached = false; tab.error = undefined
  browserTabs.value.push(tab)
  activeTab.value = tab.id
  loadError.value = ''
  if (hostBrowserReady.value) {
    options.getHostBrowser()?.open(tab.id, tab.currentUrl)
    if (muted) void options.getHostBrowser()?.control(tab.id, 'mute', true).catch(error => { externalError.value = String(error) })
  }
  return tab
}
function activateTab(id: string) {
  const tab = tabById(id)
  if (tab?.detached && hostBrowserReady.value) { tab.detached = false; void options.getHostBrowser()?.control(id, 'reattach').catch(error => { tab.detached = true; externalError.value = String(error) }) }
  activeTab.value = id; loadError.value = tab?.error || ''
}
function detachTab(id: string, grabX?: number, presentation?: { title: string; icon?: string }) {
  const tab = tabById(id)
  if (!tab) return
  if (!hostBrowserReady.value) return
  tab.detached = true
  return options.getHostBrowser()?.control(id, 'detach', undefined, grabX, presentation).catch(error => { tab.detached = false; activeTab.value = id; externalError.value = String(error) })
}
function duplicateTab(id: string) {
  const source = tabById(id)
  if (!source) return
  const tab = openBrowserTab(source.currentUrl, { ...source, id: `browser-${crypto.randomUUID()}` })
  if (tab) { tab.sourceId = source.sourceId || source.id; tab.tabPinned = false; tab.detached = false }
}
function reloadTab(id: string) {
  const tab = tabById(id)
  if (!tab) return
  tab.error = undefined
  if (activeTab.value === id) loadError.value = ''
  setTabLoading(id, true)
  if (hostBrowserReady.value) controlBrowser(id, 'reload')
  else if (isElectron) webviewEls.get(id)?.reload()
  else { activateTab(id); reloadFrame() }
}
async function toggleMute(id: string) {
  const tab = tabById(id)
  if (!tab) return
  const muted = !tab.muted, origin = new URL(tab.currentUrl).origin
  const targets = browserTabs.value.filter(item => new URL(item.currentUrl).origin === origin)
  if (!hostBrowserReady.value && !isElectron) throw new Error('网站静音需要在 Mira 桌面端使用')
  await Promise.all(targets.map(async target => {
    if (hostBrowserReady.value) await options.getHostBrowser()?.control(target.id, 'mute', muted)
    else webviewEls.get(target.id)?.setAudioMuted(muted)
    target.muted = muted
  }))
  if (muted) mutedOrigins.add(origin); else mutedOrigins.delete(origin)
}
function controlBrowser(id: string, action: 'reload' | 'close' | 'back' | 'forward' | 'stop') {
  void options.getHostBrowser()?.control(id, action).catch(error => { setTabLoading(id, false); externalError.value = error instanceof Error ? error.message : '标签操作失败' })
}
function closeTab(id: string) {
  const index = browserTabs.value.findIndex(tab => tab.id === id)
  if (index < 0) return
  clearTitleRefresh(id)
  controlBrowser(id, 'close')
  webviewEls.delete(id)
  browserTabs.value.splice(index, 1)
  if (activeTab.value === id) {
    activeTab.value = browserTabs.value[Math.max(0, index - 1)]?.id || ''
    loadError.value = currentSite.value?.error || ''
  }
}
function navigateAddress() {
  const tab = currentSite.value, value = addressDraft.value.trim()
  if (!tab || !value) return
  let url: URL
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
  } catch {
    browserToolbar.value?.invalid('请输入有效的 HTTP 或 HTTPS 网站地址，且不能包含账号密码。')
    return
  }
  clearTitleRefresh(tab.id)
  tab.currentUrl = url.href; tab.pageTitle = ''; tab.error = undefined
  loadError.value = ''; addressDraft.value = url.href
  setTabLoading(tab.id, true)
  browserToolbar.value?.blur()
  if (hostBrowserReady.value) options.getHostBrowser()?.open(tab.id, url.href)
}
async function openExternal() {
  const tab = currentSite.value
  if (!tab) return
  externalError.value = ''
  const sdk = options.getSdk()
  if (isPlatformApp && sdk) {
    try { await sdk.workbench.browser({ type: 'control', tabId: tab.id, action: 'external' } as unknown as Parameters<typeof sdk.workbench.browser>[0]) }
    catch { externalError.value = '无法打开系统浏览器，请检查默认浏览器设置或更新 Mira。' }
  } else window.open(tab.currentUrl, '_blank', 'noopener,noreferrer')
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
  if (hostBrowserReady.value) controlBrowser(tab.id, 'reload')
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
function goBack() { const tab = currentSite.value; if (tab && hostBrowserReady.value) controlBrowser(tab.id, 'back'); else { const webview = tab && webviewEls.get(tab.id); if (webview?.canGoBack()) webview.goBack() } }
function goForward() { const tab = currentSite.value; if (tab && hostBrowserReady.value) controlBrowser(tab.id, 'forward'); else { const webview = tab && webviewEls.get(tab.id); if (webview?.canGoForward()) webview.goForward() } }
function stopFrame() {
  const tab = currentSite.value
  if (!tab) return
  if (hostBrowserReady.value) controlBrowser(tab.id, 'stop')
  else if (isElectron) webviewEls.get(tab.id)?.stop()
  else {
    try { document.querySelector<HTMLIFrameElement>('.site-iframe')?.contentWindow?.stop() } catch { /* Cross-origin iframe control is optional. */ }
  }
  setTabLoading(tab.id, false)
}
function tabById(id: string) { return browserTabs.value.find(tab => tab.id === id) }
function setTabLoading(id: string, value: boolean) { const tab = tabById(id); if (tab) tab.loading = value }
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
  const tab = tabById(id)
  if (tab && isElectron) webviewEls.get(id)?.setAudioMuted(Boolean(tab.muted))
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
function handleHostBrowserState(state: HostBrowserState) {
  const tab = tabById(state.tabId)
  if (!tab) return
  if (state.url) tab.currentUrl = state.url
  if (state.title) tab.pageTitle = state.title
  tab.loading = state.loading
  tab.canGoBack = state.canGoBack ?? false
  tab.canGoForward = state.canGoForward ?? false
  if (state.muted !== undefined) tab.muted = state.muted
  if (state.detached !== undefined) {
    const wasDetached = tab.detached
    tab.detached = state.detached
    if (wasDetached && !state.detached) activeTab.value = tab.id
    else if (state.detached && activeTab.value === tab.id) activeTab.value = ''
  }
  tab.error = state.error
  if (state.faviconUrl !== undefined) tab.faviconUrl = state.faviconUrl
  if (activeTab.value === tab.id) loadError.value = state.error || ''
}

  onUnmounted(() => { for (const id of titleRefreshTimers.keys()) clearTitleRefresh(id) })
  return { browserTabs, currentSite, currentAddress, browserToolbar, addressDraft, addressEditing, pageLoading, loadError, externalError, openSite, openBrowserTab, duplicateTab, activateTab, detachTab, reloadTab, toggleMute, closeTab, navigateAddress, openExternal, webviewRef, reloadFrame, goBack, goForward, stopFrame, handleLoadStart, handleLoadFinished, frameLoaded, handleNavigate, handleLoadError, handleTitleUpdate, handleWillNavigate, handleFaviconUpdate, handleHostBrowserState }
}
