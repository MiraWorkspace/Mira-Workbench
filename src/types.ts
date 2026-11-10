import type { WebsiteEntry } from './data/sites'
import type { InstalledMiniapp } from './miniapps/manager'

export interface BrowserTab extends WebsiteEntry { currentUrl: string; loading: boolean; pageTitle: string; canGoBack: boolean; canGoForward: boolean; error?: string; faviconUrl?: string | null; tabPinned?: boolean; muted?: boolean; detached?: boolean; returning?: boolean; sourceId?: string }
export interface WorkbenchTabView { id: string; kind: 'home' | 'website' | 'miniapp'; name: string; url?: string; brand?: string; favicon?: string | null; icon?: string; customIcon?: string; cachedIcon?: string; loading: boolean; pinned: boolean; muted: boolean; returning?: boolean }
export type GridEntry = { type: 'website'; item: WebsiteEntry; name: string; builtin: boolean; pinned: boolean; opened?: boolean } | { type: 'miniapp'; item: InstalledMiniapp; name: string; builtin: boolean; pinned: boolean; opened?: boolean }
