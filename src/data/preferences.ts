export interface WorkbenchPreferences {
  openNewWindowInBrowser: boolean
  tabCacheCount: number
}

export const defaultPreferences: WorkbenchPreferences = { openNewWindowInBrowser: false, tabCacheCount: 3 }

export function normalizePreferences(value: unknown): WorkbenchPreferences {
  const input = value as Partial<WorkbenchPreferences> | null
  return {
    openNewWindowInBrowser: input?.openNewWindowInBrowser === true,
    tabCacheCount: typeof input?.tabCacheCount === 'number' && Number.isFinite(input.tabCacheCount) ? Math.max(0, Math.min(10, Math.round(input.tabCacheCount))) : defaultPreferences.tabCacheCount,
  }
}
