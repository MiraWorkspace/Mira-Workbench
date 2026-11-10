import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer, ref } from 'vue'
import { useBrowserTabs } from '../src/composables/useBrowserTabs.ts'

function fixture(external = false) {
  const calls = [], activeTab = ref('home')
  const sdk = { workbench: { browser: async request => { calls.push(['sdk', request]) } } }
  const host = { open: (...args) => calls.push(['open', ...args]), control: async (...args) => { calls.push(['control', ...args]) } }
  let tabs
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null })
  const app = renderer.createApp({ setup() { tabs = useBrowserTabs({ activeTab, hostBrowserReady: ref(true), getHostBrowser: () => host, getSdk: () => sdk, openSitesExternally: () => external, isElectron: false, isPlatformApp: true }); return () => null } })
  app.mount({})
  return { tabs, calls, activeTab, dispose: () => app.unmount() }
}

test('opens a site externally without creating an internal tab when enabled', () => {
  const { tabs, calls, activeTab, dispose } = fixture(true)
  try {
    tabs.openSite({ id: 'site', url: 'https://example.com/' })
    assert.deepEqual(calls, [['sdk', { type: 'external', url: 'https://example.com/' }]])
    assert.equal(tabs.browserTabs.value.length, 0)
    assert.equal(activeTab.value, 'home')
  } finally { dispose() }
})

test('releases a background page while retaining its tab and reopens its latest URL', () => {
  const { tabs, calls, activeTab, dispose } = fixture()
  try {
    const tab = tabs.openBrowserTab('https://example.com/')
    tabs.handleHostBrowserState({ tabId: tab.id, url: 'https://example.com/next', loading: false, canGoBack: true })
    activeTab.value = 'home'
    tabs.suspendTab(tab.id)
    assert.equal(tabs.browserTabs.value.length, 1)
    assert.equal(tabs.residentBrowserTabs.value.length, 0)
    assert.equal(tab.loading, false)
    assert.deepEqual(calls.at(-1), ['control', tab.id, 'close'])
    tabs.handleHostBrowserState({ tabId: tab.id, url: 'https://example.com/stale', loading: true })
    tabs.openSite({ ...tab, id: tab.id })
    assert.equal(tabs.browserTabs.value.length, 1)
    assert.equal(tabs.residentBrowserTabs.value.length, 1)
    assert.deepEqual(calls.at(-1), ['open', tab.id, 'https://example.com/next'])
    assert.equal(activeTab.value, tab.id)
    assert.equal(tab.canGoBack, false)
  } finally { dispose() }
})

test('keeps active and detached pages alive and does not close a released page twice', () => {
  const { tabs, calls, activeTab, dispose } = fixture()
  try {
    const tab = tabs.openBrowserTab('https://example.com/')
    tabs.suspendTab(tab.id)
    assert.equal(calls.length, 1)
    activeTab.value = 'home'; tab.detached = true
    tabs.suspendTab(tab.id)
    assert.equal(calls.length, 1)
    tab.detached = false
    tabs.suspendTab(tab.id)
    tabs.suspendTab(tab.id)
    tabs.closeTab(tab.id)
    assert.equal(calls.filter(call => call[2] === 'close').length, 1)
    assert.equal(tabs.browserTabs.value.length, 0)
  } finally { dispose() }
})
