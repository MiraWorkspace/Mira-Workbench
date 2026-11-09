import type { WebsiteEntry } from './data/sites'
import type { InstalledMiniapp } from './miniapps/manager'

export interface BrowserTab extends WebsiteEntry { currentUrl: string; loading: boolean; pageTitle: string; canGoBack: boolean; canGoForward: boolean; error?: string; faviconUrl?: string | null }
export type GridEntry = { type: 'website'; item: WebsiteEntry; name: string; builtin: boolean; pinned: boolean } | { type: 'miniapp'; item: InstalledMiniapp; name: string; builtin: boolean; pinned: boolean }
