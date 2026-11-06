export type WorkbenchValue = string | number | null
export type WorkbenchOperation =
  | { type: 'insert'; table: string; values: Record<string, WorkbenchValue> }
  | { type: 'update'; table: string; values: Record<string, WorkbenchValue>; where: Record<string, WorkbenchValue> }
  | { type: 'delete'; table: string; where: Record<string, WorkbenchValue> }
  | { type: 'select'; table: string; where?: Record<string, WorkbenchValue>; orderBy?: Array<{ column: string; direction: 'asc' | 'desc' }>; limit?: number; offset?: number }

export interface WorkbenchStorage {
  migrate(versions: typeof migrations): Promise<number>
  transaction(operations: WorkbenchOperation[]): Promise<unknown[]>
}

export interface WorkbenchEntry {
  id: string
  type: 'website' | 'miniapp'
  name: string
  address: string
  icon?: string
  category?: string
  builtin: boolean
  visible: boolean
}

const migrations = [{ version: 1, tables: [
  { name: 'entries', columns: [
    { name: 'id', type: 'TEXT' as const, primaryKey: true },
    { name: 'type', type: 'TEXT' as const, notNull: true },
    { name: 'name', type: 'TEXT' as const, notNull: true },
    { name: 'address', type: 'TEXT' as const, notNull: true },
    { name: 'icon', type: 'TEXT' as const },
    { name: 'category', type: 'TEXT' as const },
    { name: 'builtin', type: 'INTEGER' as const, notNull: true },
    { name: 'visible', type: 'INTEGER' as const, notNull: true },
    { name: 'position', type: 'INTEGER' as const, notNull: true },
  ] },
  { name: 'settings', columns: [
    { name: 'key', type: 'TEXT' as const, primaryKey: true },
    { name: 'value', type: 'TEXT' as const, notNull: true },
  ] },
] }]

function row(entry: WorkbenchEntry, position: number): Record<string, WorkbenchValue> {
  return { id: entry.id, type: entry.type, name: entry.name, address: entry.address, icon: entry.icon ?? null, category: entry.category ?? null, builtin: Number(entry.builtin), visible: Number(entry.visible), position }
}

function fromRow(value: unknown): WorkbenchEntry {
  const item = value as Record<string, unknown>
  if (!item || typeof item.id !== 'string' || (item.type !== 'website' && item.type !== 'miniapp') || typeof item.name !== 'string' || typeof item.address !== 'string' || (item.builtin !== 0 && item.builtin !== 1) || (item.visible !== 0 && item.visible !== 1)) throw new Error('工作台数据无效')
  return { id: item.id, type: item.type, name: item.name, address: item.address, ...(typeof item.icon === 'string' ? { icon: item.icon } : {}), ...(typeof item.category === 'string' ? { category: item.category } : {}), builtin: item.builtin === 1, visible: item.visible === 1 }
}

export function parseLegacySites(raw: string | null): WorkbenchEntry[] {
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value)) throw new Error('旧网站数据无效')
  const ids = new Set<string>()
  return value.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || typeof item.url !== 'string' || !['assistant', 'search'].includes(item.category)) throw new Error('旧网站数据无效')
    ids.add(item.id)
    return { id: item.id, type: 'website' as const, name: item.name, address: item.url, ...(typeof item.brand === 'string' ? { icon: item.brand } : {}), category: item.category, builtin: item.builtin === true, visible: item.visible !== false }
  })
}

export class WorkbenchStore {
  private readonly storage: WorkbenchStorage
  constructor(storage: WorkbenchStorage) { this.storage = storage }

  private async readRows(): Promise<WorkbenchEntry[]> {
    const result: WorkbenchEntry[] = []
    for (let offset = 0;; offset += 1000) {
      const [page] = await this.storage.transaction([{ type: 'select', table: 'entries', orderBy: [{ column: 'position', direction: 'asc' }, { column: 'id', direction: 'asc' }], limit: 1000, offset }])
      if (!Array.isArray(page)) throw new Error('工作台数据无效')
      result.push(...page.map(fromRow))
      if (page.length < 1000) return result
    }
  }

  async initialize(legacySource: string | null | (() => Promise<string | null>), builtins: WorkbenchEntry[]): Promise<WorkbenchEntry[]> {
    await this.storage.migrate(migrations)
    const [markers] = await this.storage.transaction([{ type: 'select', table: 'settings', where: { key: 'legacy_sites_imported' } }])
    if (!Array.isArray(markers)) throw new Error('工作台迁移状态无效')
    let entries = await this.readRows()
    if (!markers.length) {
      const legacy = parseLegacySites(typeof legacySource === 'function' ? await legacySource() : legacySource)
      const ids = new Set(entries.map(item => item.id))
      const missing = legacy.filter(item => !ids.has(item.id))
      for (let offset = 0; offset < missing.length; offset += 100) {
        const batch = missing.slice(offset, offset + 100)
        await this.storage.transaction(batch.map((item, index) => ({ type: 'insert', table: 'entries', values: row(item, entries.length + offset + index) })))
      }
      await this.storage.transaction([{ type: 'insert', table: 'settings', values: { key: 'legacy_sites_imported', value: '1' } }])
      entries = await this.readRows()
    }
    const ids = new Set(entries.map(item => item.id))
    const added = builtins.filter(item => !ids.has(item.id))
    for (let offset = 0; offset < added.length; offset += 100) {
      await this.storage.transaction(added.slice(offset, offset + 100).map((item, index) => ({ type: 'insert', table: 'entries', values: row(item, entries.length + offset + index) })))
    }
    return added.length ? this.readRows() : entries
  }

  async save(entries: WorkbenchEntry[]) {
    const current = await this.readRows()
    const nextIds = new Set(entries.map(item => item.id))
    const currentRows = new Map(current.map((item, index) => [item.id, row(item, index)]))
    const reordered = current.length !== entries.length || current.some((item, index) => item.id !== entries[index]?.id)
    const operations: WorkbenchOperation[] = current.filter(item => !nextIds.has(item.id)).map(item => ({ type: 'delete', table: 'entries', where: { id: item.id } }))
    entries.forEach((item, index) => {
      const values = row(item, index)
      if (currentRows.has(item.id)) {
        if (!reordered && JSON.stringify(currentRows.get(item.id)) === JSON.stringify(values)) return
        const { id, ...updated } = values; operations.push({ type: 'update', table: 'entries', values: updated, where: { id } })
      }
      else operations.push({ type: 'insert', table: 'entries', values })
    })
    if (operations.length > 10000) throw new Error('工作台条目过多，无法一次保存')
    if (operations.length) await this.storage.transaction(operations)
  }
}
