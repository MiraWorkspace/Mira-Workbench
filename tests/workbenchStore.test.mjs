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
