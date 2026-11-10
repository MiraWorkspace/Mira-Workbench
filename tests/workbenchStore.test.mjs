import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WorkbenchStore, parseLegacySites } from '../src/data/workbenchStore.ts'

class Storage {
  tables = { entries: [], settings: [] }
  failInsertAt = 0
  insertBatches = 0
  async migrate() { return 1 }
  async transaction(operations) {
    if (operations.some(operation => operation.type === 'insert' && operation.table === 'entries') && ++this.insertBatches === this.failInsertAt) throw new Error('injected failure')
    const next = structuredClone(this.tables)
    const results = operations.map(operation => {
      const table = next[operation.table]
      const matches = row => Object.entries(operation.where ?? {}).every(([key, value]) => row[key] === value)
      if (operation.type === 'select') {
        const rows = table.filter(matches)
        if (operation.orderBy) rows.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        return rows.slice(operation.offset ?? 0, (operation.offset ?? 0) + (operation.limit ?? 100))
      }
      if (operation.type === 'insert') {
        const key = operation.table === 'entries' ? 'id' : 'key'
        if (table.some(row => row[key] === operation.values[key])) throw new Error('duplicate')
        table.push({ ...operation.values }); return 1
      }
      if (operation.type === 'update') { for (const row of table.filter(matches)) Object.assign(row, operation.values); return 1 }
      const remaining = table.filter(row => !matches(row))
      next[operation.table] = remaining
      return table.length - remaining.length
    })
    this.tables = next
    return results
  }
}

const builtin = { id: 'builtin', type: 'website', name: 'Original', address: 'https://example.com/', builtin: true, visible: true }
const legacy = count => JSON.stringify(Array.from({ length: count }, (_, index) => ({ id: `site-${index}`, name: `Site ${index}`, url: `https://example.com/${index}`, category: 'assistant', builtin: false, visible: index !== 0 })))

test('resumes a failed import without duplicates and leaves the legacy source untouched', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage), raw = legacy(120)
  storage.failInsertAt = 2
  await assert.rejects(store.initialize(raw, [builtin]), /injected failure/)
  assert.equal(storage.tables.entries.length, 100)
  assert.equal(storage.tables.settings.length, 0)
  storage.failInsertAt = 0
  const entries = await store.initialize(raw, [builtin])
  assert.equal(entries.length, 121)
  assert.equal(new Set(entries.map(item => item.id)).size, 121)
  assert.equal(entries[0].visible, false)
  assert.equal(raw, legacy(120))
  assert.equal((await store.initialize(raw, [builtin])).length, 121)
  await store.initialize(() => { throw new Error('completed import must not read legacy storage') }, [builtin])
  entries.splice(0, 1)
  await store.save(entries)
  assert.equal((await store.initialize(raw, [builtin])).length, 120)
})

test('merges new builtins without replacing user changes and saves changes atomically', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  const entries = await store.initialize(null, [builtin])
  entries[0].name = 'Edited'; entries[0].visible = false
  await store.save(entries)
  const merged = await store.initialize(null, [builtin, { ...builtin, id: 'new', name: 'New' }])
  assert.deepEqual(merged.map(item => [item.id, item.name, item.visible]), [['builtin', 'Edited', false], ['new', 'New', true]])
})

test('invalid legacy data does not mark migration as complete', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  await assert.rejects(store.initialize('{', [builtin]))
  assert.equal(storage.tables.settings.length, 0)
  assert.throws(() => parseLegacySites('{}'))
  assert.equal((await store.initialize(legacy(1), [builtin])).length, 2)
})

test('imports a modified built-in without replacing its address or visibility', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  const raw = JSON.stringify([{ id: 'builtin', name: 'Modified', url: 'https://different.example/', category: 'assistant', builtin: true, visible: false, brand: 'old-model-icon' }])
  const entries = await store.initialize(raw, [builtin])
  assert.deepEqual(entries.map(({ id, name, address, visible }) => ({ id, name, address, visible })), [{ id: 'builtin', name: 'Modified', address: 'https://different.example/', visible: false }])
  assert.equal((await store.initialize(raw, [builtin])).length, 1)
})

test('preserves uploaded logos through legacy import, save and reopening storage', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  const icon = 'data:image/png;base64,iVBORw0KGgo='
  const raw = JSON.stringify([{ id: 'custom-logo', name: 'Custom', url: 'https://example.com/logo', category: 'assistant', iconUrl: icon, brand: 'old-brand' }])
  const entries = await store.initialize(raw, [])
  assert.equal(entries[0].icon, icon)
  entries[0].name = 'Edited'
  await store.save(entries)
  const reopened = await new WorkbenchStore(storage).initialize(null, [])
  assert.equal(reopened[0].icon, icon)
  assert.equal(reopened[0].name, 'Edited')
})

test('retains an existing custom icon URL when importing legacy sites', () => {
  const raw = JSON.stringify([{ id: 'custom-icon', name: 'Custom', url: 'https://example.com/', category: 'assistant', iconUrl: 'https://example.com/icon.png' }])
  assert.equal(parseLegacySites(raw)[0].icon, 'https://example.com/icon.png')
})

test('preserves automatic icon bytes separately from an uploaded logo when reopening storage', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  const entries = await store.initialize(null, [builtin])
  entries[0].cachedIcon = 'data:image/png;base64,AQID'
  await store.save(entries)
  assert.equal(storage.tables.entries[0].cached_icon, 'data:image/png;base64,AQID')
  const reopened = await new WorkbenchStore(storage).initialize(null, [builtin])
  assert.equal(reopened[0].cachedIcon, 'data:image/png;base64,AQID')
  reopened[0].icon = 'data:image/png;base64,BAUG'
  await store.save(reopened)
  const uploaded = await new WorkbenchStore(storage).initialize(null, [builtin])
  assert.equal(uploaded[0].icon, 'data:image/png;base64,BAUG')
  assert.equal(uploaded[0].cachedIcon, 'data:image/png;base64,AQID')
})

test('persists pinned state for websites and miniapps and reads old rows as unpinned', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  const entries = await store.initialize(null, [builtin, { id: 'miniapp:demo', type: 'miniapp', name: 'Demo', address: 'demo', builtin: false, visible: true }])
  assert.equal(entries[0].pinned, false)
  entries[0].pinned = true
  entries[1].pinned = true
  await store.save(entries)
  const reopened = await new WorkbenchStore(storage).initialize(null, [builtin])
  assert.deepEqual(reopened.map(entry => entry.pinned), [true, true])
  reopened[0].pinned = false
  await store.save(reopened)
  assert.equal((await store.initialize(null, [builtin]))[0].pinned, false)
})

test('defaults to three cached tabs and persists preferences without replacing migration markers', async () => {
  const storage = new Storage(), store = new WorkbenchStore(storage)
  await store.initialize(null, [builtin])
  assert.deepEqual(await store.readPreferences(), { openNewWindowInBrowser: false, tabCacheCount: 3 })
  for (const count of [0, 10, 3]) {
    await store.savePreferences({ openNewWindowInBrowser: true, tabCacheCount: count })
    assert.deepEqual(await new WorkbenchStore(storage).readPreferences(), { openNewWindowInBrowser: true, tabCacheCount: count })
  }
  assert.equal(storage.tables.settings.find(row => row.key === 'legacy_sites_imported').value, '1')
  await store.savePreferences({ openNewWindowInBrowser: false, tabCacheCount: 20 })
  assert.equal((await store.readPreferences()).tabCacheCount, 10)
})
