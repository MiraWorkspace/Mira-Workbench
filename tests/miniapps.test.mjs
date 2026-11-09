import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { inspectPackage } from '../src/miniapps/package.ts'
import { MiniappManager } from '../src/miniapps/manager.ts'

const manifest = { manifestVersion: 1, id: 'notes', name: 'Notes', version: '1.0.0', entry: 'index.html', requiredCapabilities: ['storage:app', 'files:read', 'files:write', 'models:generate'] }
const pack = (changes = {}, extra = {}) => zipSync({ 'miniapp-manifest.json': strToU8(JSON.stringify({ ...manifest, ...changes })), 'index.html': strToU8('<h1>Notes</h1>'), ...extra })
function fixture() {
  const files = new Map(), replies = [], operations = [], grants = new Map()
  let nextView = 1, listener, items = [], confirm = true, failPath = '', generate = async () => ({ text: 'result' })
  const sdk = {
    files: {
      async list({ path = '' } = {}) { const prefix = path ? path + '/' : ''; return [...new Set([...files.keys()].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split('/')[0]))].map(name => ({ name, directory: [...files.keys()].some(key => key.startsWith(prefix + name + '/')) })) },
      async read({ path, grant }) { if (grant && !grants.has(grant)) throw Error('no grant'); if (!files.has(path)) throw Error('missing'); return files.get(path) },
      async write({ path, data, grant }) { if (path === failPath) throw Error('injected write failure'); if (grant && grants.get(grant) !== 'readwrite') throw Error('read only'); files.set(path, data); operations.push({ path, grant }) },
      async remove({ path }) { for (const key of files.keys()) if (key === path || key.startsWith(path + '/')) files.delete(key) },
      async selectDirectory(access) { const id = crypto.randomUUID(); grants.set(id, access); return { id, name: 'Selected', access } },
      async revoke(id) { grants.delete(id) },
    },
    views: { subscribe(fn) { listener = fn; return () => {} }, async control(input) { if (input.type === 'open') return nextView++; replies.push(input) } },
    storage: { async legacyWorkbenchMiniapps() { return [] }, async migrate(migrations, namespace) { operations.push({ migrations, namespace }); return 1 }, async transaction(ops, namespace) { operations.push({ ops, namespace }); return [[]] } },
    models: { generate: (...args) => generate(...args) }, notifications: { async send() {} }, appearance: { async get() { return 'light' } },
  }
  const manager = new MiniappManager(sdk, async () => confirm, next => { items = next }, () => {})
  return { manager, files, replies, operations, grants, get items() { return items }, set confirm(value) { confirm = value }, set failPath(value) { failPath = value }, set generate(value) { generate = value }, request: (viewId, method, params) => manager.handleRequest({ viewId, requestId: crypto.randomUUID(), method, params }) }
}

test('Workbench validates packages and rejects traversal, reserved identity and platform management permissions', () => {
  assert.equal(inspectPackage(pack()).manifest.id, 'notes')
  assert.throws(() => inspectPackage(pack({}, { '../escape': strToU8('bad') })), /路径/)
  assert.throws(() => inspectPackage(pack({ requiredCapabilities: ['views:create'] })), /权限/)
  assert.throws(() => inspectPackage(pack({ id: 'mira-workbench' })), /ID/)
  assert.throws(() => inspectPackage(pack({ entry: 'missing.html' })), /不存在/)
})

test('Workbench installs, opens, updates immediately, retains data and uninstalls without any platform app lifecycle API', async () => {
  const f = fixture(); await f.manager.initialize()
  f.confirm = false; assert.equal(await f.manager.install(pack()), false); assert.equal(f.items.length, 0)
  f.confirm = true; await f.manager.install(pack()); const view = await f.manager.open('notes')
  await f.request(view, 'storage.transaction', { operations: [{ type: 'select', table: 'drafts' }], namespace: 'other' })
  assert.equal(f.operations.at(-1).namespace, 'notes')
  await f.request(view, 'files.write', { path: 'draft.txt', data: strToU8('retained') })
  assert.ok(f.files.has('miniapps/data/notes/draft.txt'))
  await f.manager.install(pack({ version: '1.1.0' }))
  assert.equal(f.items[0].manifest.version, '1.1.0'); assert.ok(f.replies.some(reply => reply.type === 'close' && reply.id === view))
  assert.ok(f.files.has('miniapps/data/notes/draft.txt'))
  await assert.rejects(f.manager.install(pack()), /版本/)
  await f.manager.uninstall('notes'); assert.equal(f.items.length, 0); assert.ok(f.files.has('miniapps/data/notes/draft.txt'))
})

test('failed update preserves the committed registry and working release', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack())
  const release = f.items[0].release; f.failPath = 'miniapps/registry.json'
  await assert.rejects(f.manager.install(pack({ version: '1.1.0' })), /injected/)
  assert.equal(f.items[0].release, release); assert.ok(f.files.has(release + '/index.html'))
  f.failPath = ''; await f.manager.open('notes')
})

test('permission checks isolate files, reject forged methods and enforce read-only directories', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); const view = await f.manager.open('notes')
  await f.request(view, 'files.read', { path: '../packages/notes/index.html' }); assert.equal(f.replies.at(-1).ok, false)
  await f.request(view, 'views.control', { type: 'open' }); assert.equal(f.replies.at(-1).ok, false)
  await f.request(view, 'files.write', { path: 'stolen', grant: 'forged', data: strToU8('bad') }); assert.equal(f.replies.at(-1).ok, false)
  await f.manager.addDirectory('notes', 'read'); const grant = f.items[0].directories[0]
  await f.request(view, 'files.write', { path: 'read-only.txt', grant: grant.id, data: strToU8('bad') }); assert.equal(f.replies.at(-1).ok, false)
  assert.equal(f.files.has('read-only.txt'), false)
  await f.manager.removeDirectory('notes', grant.id); assert.equal(f.grants.has(grant.id), false)
})

test('revocation closes running views and suppresses delayed model results', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); const view = await f.manager.open('notes')
  let finish; f.generate = () => new Promise(resolve => { finish = resolve })
  const pending = f.request(view, 'models.generate', { prompt: 'hello' }); await f.manager.revoke('notes')
  finish({ text: 'late secret' }); await pending
  assert.equal(f.replies.some(reply => reply.ok && reply.value?.text === 'late secret'), false)
  assert.ok(f.replies.some(reply => reply.type === 'close' && reply.id === view))
  assert.deepEqual(f.items[0].approved, [])
})

test('registry and independent data survive reopening the Workbench manager', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); await f.manager.dispose()
  await f.manager.initialize(); assert.equal(f.items[0].manifest.version, '1.0.0'); assert.equal(typeof await f.manager.open('notes'), 'number')
})

test('failed first authorization does not grant permissions or open a view', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); await f.manager.revoke('notes')
  f.failPath = 'miniapps/registry.json'
  await assert.rejects(f.manager.open('notes'), /injected/)
  assert.deepEqual(f.items[0].approved, []); assert.equal(f.items[0].reviewed, false)
  f.failPath = ''; f.confirm = false
  assert.equal(await f.manager.open('notes'), undefined)
  f.confirm = true; assert.equal(typeof await f.manager.open('notes'), 'number')
})
