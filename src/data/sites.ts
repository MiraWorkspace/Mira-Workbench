import builtinCatalog from './builtin-sites.json'

export type SiteCategory = 'assistant' | 'search'

export interface WebsiteEntry {
  id: string
  name: string
  url: string
  category: SiteCategory
  brand?: string
  iconUrl?: string
  builtin: boolean
  visible: boolean
}

export const builtinSites: WebsiteEntry[] = builtinCatalog.map(site => ({ ...site, category: site.category as SiteCategory, brand: site.id, builtin: true, visible: true }))

export const sitesStorageKey = `${__MIRA_APP_ID__}.sites.v1`

export function readSites(): WebsiteEntry[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(sitesStorageKey) || 'null')
    if (!Array.isArray(stored)) return structuredClone(builtinSites)
    const entries = stored.filter((entry): entry is WebsiteEntry =>
      Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.url === 'string' && ['assistant', 'search'].includes(entry.category)),
    )
    return entries.length ? entries.map(entry => entry.builtin ? { ...entry, brand: builtinSites.some(site => site.id === entry.id && site.url === entry.url) ? entry.id : undefined } : entry) : structuredClone(builtinSites)
  } catch {
    return structuredClone(builtinSites)
  }
}
