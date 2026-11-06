import type { MiraAppSdk } from '@mira/app-sdk'

export interface HostBrowserState {
  tabId: string; url?: string; title?: string; loading: boolean; canGoBack?: boolean; canGoForward?: boolean; error?: string; faviconUrl?: string | null
}
export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop' | 'close'

export function connectPlatformBrowser(sdk: MiraAppSdk, state: (value: HostBrowserState) => void, openTab: (url: string) => void) {
  let disposed = false
  const receive = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'mira:workbench-browser-event') return
    const value = event.data.value
    if (value?.type === 'state' && typeof value.tabId === 'string') state(value)
    else if (value?.type === 'open-tab' && typeof value.url === 'string') openTab(value.url)
  }
  window.addEventListener('message', receive)
  const send = (request: Parameters<typeof sdk.workbench.browser>[0]) => {
    void sdk.workbench.browser(request).catch(() => {
      if (!disposed && request.type === 'open') state({ tabId: request.tabId, loading: false, error: '网页无法打开，请重试。' })
    })
  }
  return {
    open(tabId: string, url: string) { send({ type: 'open', tabId, url }) },
    control(tabId: string, action: BrowserAction) { send({ type: 'control', tabId, action }) },
    layout(tabId: string, element: HTMLElement | undefined, visible: boolean) {
      const bounds = element?.getBoundingClientRect()
      send({ type: 'layout', tabId, visible: visible && Boolean(bounds?.width && bounds.height), bounds: bounds ? { x: Math.max(0, bounds.x), y: Math.max(0, bounds.y), width: bounds.width, height: bounds.height } : { x: 0, y: 0, width: 0, height: 0 } })
    },
    dispose() { disposed = true; window.removeEventListener('message', receive) },
  }
}

export function connectHostBrowser(connected: () => void, state: (value: HostBrowserState) => void) {
  let port: MessagePort | undefined
  let attempts = 0
  function request() {
    if (port || attempts++ >= 5) { window.clearInterval(retry); return }
    window.parent.postMessage({ type: 'mira:workbench-browser-connect' }, '*')
  }
  function receive(event: MessageEvent) {
    if (event.source !== window.parent || event.data?.type !== 'mira:workbench-browser-connected' || !event.ports[0] || port) return
    port = event.ports[0]
    window.clearInterval(retry)
    port.onmessage = event => { if (event.data?.type === 'state' && typeof event.data.tabId === 'string') state(event.data) }
    connected()
  }
  window.addEventListener('message', receive)
  const retry = window.setInterval(request, 250)
  request()
  return {
    open(tabId: string, url: string) { port?.postMessage({ type: 'open', tabId, url }) },
    control(tabId: string, action: BrowserAction) { port?.postMessage({ type: 'control', tabId, action }) },
    layout(tabId: string, element: HTMLElement | undefined, visible: boolean) {
      const bounds = element?.getBoundingClientRect()
      port?.postMessage({ type: 'layout', tabId, visible: visible && Boolean(bounds?.width && bounds.height), bounds: bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : { x: 0, y: 0, width: 0, height: 0 } })
    },
    dispose() { window.clearInterval(retry); window.removeEventListener('message', receive); port?.postMessage({ type: 'dispose' }); port?.close() },
  }
}
