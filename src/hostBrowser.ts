import type { MiraAppSdk } from '@mira/app-sdk'

export interface HostBrowserState {
  tabId: string; url?: string; title?: string; loading: boolean; canGoBack?: boolean; canGoForward?: boolean; muted?: boolean; detached?: boolean; error?: string; faviconUrl?: string | null
}
export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop' | 'close' | 'mute' | 'detach' | 'reattach' | 'end-drag'

export function connectPlatformBrowser(sdk: MiraAppSdk, state: (value: HostBrowserState) => void, openTab: (url: string) => void) {
  let disposed = false
  const receive = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'mira:workbench-browser-event') return
    const value = event.data.value
    if (value?.type === 'state' && typeof value.tabId === 'string') state(value)
    else if (value?.type === 'open-tab' && typeof value.url === 'string') openTab(value.url)
  }
  window.addEventListener('message', receive)
  type BrowserRequest = Parameters<typeof sdk.workbench.browser>[0] | { type: 'control'; tabId: string; action: BrowserAction; muted?: boolean; dragOffset?: number; presentation?: { title: string; icon?: string } } | { type: 'overlay'; open: boolean }
  const requestBrowser = sdk.workbench.browser as (request: BrowserRequest) => Promise<void>
  const send = (request: BrowserRequest) => {
    void requestBrowser(request).catch(() => {
      if (!disposed && request.type === 'open') state({ tabId: request.tabId, loading: false, error: '网页无法打开，请重试。' })
    })
  }
  return {
    open(tabId: string, url: string) { send({ type: 'open', tabId, url }) },
    control(tabId: string, action: BrowserAction, muted?: boolean, dragOffset?: number, presentation?: { title: string; icon?: string }) { return requestBrowser({ type: 'control', tabId, action, ...(action === 'mute' ? { muted: Boolean(muted) } : {}), ...(dragOffset !== undefined ? { dragOffset } : {}), ...(presentation ? { presentation } : {}) }) },
    overlay(open: boolean) { return requestBrowser({ type: 'overlay', open }) },
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
    control(tabId: string, action: BrowserAction, muted?: boolean, _dragOffset?: number, _presentation?: { title: string; icon?: string }) { if (action === 'mute' || action === 'detach' || action === 'reattach' || action === 'end-drag') return Promise.reject(new Error('此操作需要更新 Mira 并通过应用选择器打开工作台')); port?.postMessage({ type: 'control', tabId, action }); return Promise.resolve() },
    overlay(_open: boolean) { return Promise.resolve() },
    layout(tabId: string, element: HTMLElement | undefined, visible: boolean) {
      const bounds = element?.getBoundingClientRect()
      port?.postMessage({ type: 'layout', tabId, visible: visible && Boolean(bounds?.width && bounds.height), bounds: bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : { x: 0, y: 0, width: 0, height: 0 } })
    },
    dispose() { window.clearInterval(retry); window.removeEventListener('message', receive); port?.postMessage({ type: 'dispose' }); port?.close() },
  }
}
