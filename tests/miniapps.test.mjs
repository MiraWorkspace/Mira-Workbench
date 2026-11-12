import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { inspectPackage } from '../src/miniapps/package.ts'
import { MiniappManager } from '../src/miniapps/manager.ts'

const manifest = { manifestVersion: 1, id: 'notes', name: 'Notes', version: '1.0.0', entry: 'index.html', requiredCapabilities: ['storage:app', 'files:read', 'files:write', 'models:generate'] }
const pack = (changes = {}, extra = {}) => zipSync({ 'miniapp-manifest.json': strToU8(JSON.stringify({ ...manifest, ...changes })), 'index.html': strToU8('<h1>Notes</h1>'), ...extra })
function fixture() {
  const files = new Map(), replies = [], operations = [], grants = new Map(), modelCalls = [], searchCalls = [], reviews = []
  let nextView = 1, listener, items = [], confirm = true, failPath = '', generate = async () => ({ text: 'result' }), chat = async () => ({ text: 'chat result' }), search = async () => ({ engine: 'bing', results: [{ title: 'TypeScript', url: 'https://www.typescriptlang.org/' }] })
  const sdk = {
    context: { async get() { return { apiVersion: { major: 1, minor: 4 } } } },
    workbench: { async fetchMiniappResource() { throw Error('offline') } },
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
    web: { search: input => { searchCalls.push(input); return search(input) } },
    models: {
      generate: (...args) => generate(...args),
      async listProviders() { modelCalls.push(['providers']); return [{ id: 'p', name: 'Provider' }] },
      async listModels(id) { modelCalls.push(['models', id]); return [{ id: 'm', name: 'Model' }] },
      chat: input => { modelCalls.push(['chat', input]); return chat(input) },
    }, notifications: { async send() {} }, appearance: { async get() { return 'light' } },
  }
  const manager = new MiniappManager(sdk, async request => { reviews.push(request); return confirm }, next => { items = next }, () => {})
  return { manager, sdk, reviews, files, replies, operations, grants, modelCalls, searchCalls, get items() { return items }, set confirm(value) { confirm = value }, set failPath(value) { failPath = value }, set generate(value) { generate = value }, set chat(value) { chat = value }, set search(value) { search = value }, request: (viewId, method, params) => manager.handleRequest({ viewId, requestId: crypto.randomUUID(), method, params }) }
}

test('URL installs preserve review, cancellation, version policy and the previous release on download errors', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack())
  const url = 'https://example.com/manifest.json', release = f.items[0].release
  await assert.rejects(f.manager.installFromUrl(url), /offline/); assert.equal(f.items[0].release, release)
  const update = { url }, bytes = pack({ version: '1.1.0', update })
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')
  const document = { ...manifest, version: '1.1.0', update, package: { url: 'https://example.com/1.1.0.miniapp', sha256, size: bytes.length } }
  f.sdk.workbench.fetchMiniappResource = async (_url, kind) => kind === 'manifest' ? strToU8(JSON.stringify(document)) : bytes
  f.confirm = false; assert.equal(await f.manager.installFromUrl(url), false); assert.equal(f.items[0].release, release)
  assert.equal(f.reviews.at(-1).source, url)
  f.confirm = true; assert.equal(await f.manager.installFromUrl(url), true); assert.equal(f.items[0].manifest.version, '1.1.0')
  await assert.rejects(f.manager.installFromUrl(url), /版本/)
  const view = await f.manager.open('notes'); await f.request(view, 'workbench.fetchMiniappResource', { url, kind: 'manifest' }); assert.equal(f.replies.at(-1).ok, false)
  f.sdk.context.get = async () => ({ apiVersion: { major: 1, minor: 3 } })
  await assert.rejects(f.manager.installFromUrl(url), /更新 Mira/)
})

test('Workbench validates packages and rejects traversal, reserved identity and platform management permissions', () => {
  assert.equal(inspectPackage(pack()).manifest.id, 'notes')
  assert.throws(() => inspectPackage(pack({}, { '../escape': strToU8('bad') })), /路径/)
  assert.throws(() => inspectPackage(pack({ requiredCapabilities: ['views:create'] })), /权限/)
  assert.throws(() => inspectPackage(pack({ id: 'mira-workbench' })), /ID/)
  assert.throws(() => inspectPackage(pack({ entry: 'missing.html' })), /不存在/)
})

test('optional descriptions validate and survive package review, installation and reload', async () => {
  assert.equal(inspectPackage(pack()).manifest.description, undefined)
  for (const description of ['', '  ', 42, null, 'x'.repeat(501), 'bad\u0000text']) assert.throws(() => inspectPackage(pack({ description })), /简介/)
  const description = '展示 SDK 能力。\n通过示例了解权限边界。', icon = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const f = fixture(); await f.manager.initialize()
  const bytes = pack({ description: '  ' + description + '  ', icon: 'icon.svg' }, { 'icon.svg': strToU8(icon) })
  const before = f.files.size
  f.confirm = false; await f.manager.install(bytes)
  assert.equal(f.files.size, before)
  assert.equal(f.reviews.at(-1).manifest.description, description)
  assert.equal(f.reviews.at(-1).manifest.id, manifest.id)
  assert.match(f.reviews.at(-1).icon, /^data:image\/svg\+xml;base64,/)
  assert.deepEqual(f.reviews.at(-1).permissions, [...manifest.requiredCapabilities].sort())
  f.confirm = true; await f.manager.install(bytes)
  assert.equal(f.items[0].manifest.description, description)
  assert.equal(f.items[0].icon, f.reviews.at(-1).icon)
  await f.manager.initialize(); assert.equal(f.items[0].manifest.description, description)
  await f.manager.install(pack({ version: '1.1.0' }))
  assert.equal(f.reviews.at(-1).currentVersion, '1.0.0')
  assert.equal(f.reviews.at(-1).manifest.description, undefined)
  await f.manager.setPermissions('notes', []); await f.manager.setPermissions('notes', ['storage:app'])
  assert.deepEqual(f.reviews.at(-1).permissions, ['storage:app'])
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

test('uninstalls without a confirmation while retaining independent data', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack())
  const view = await f.manager.open('notes')
  await f.request(view, 'files.write', { path: 'draft.txt', data: strToU8('retained') })
  f.confirm = false
  assert.equal(await f.manager.uninstall('notes'), true)
  assert.equal(f.items.length, 0)
  assert.ok(f.files.has('miniapps/data/notes/draft.txt'))
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

test('web search has its own permission, forwards the query and suppresses revoked results', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); let view = await f.manager.open('notes')
  await f.request(view, 'web.search', { query: 'TypeScript' })
  assert.equal(f.replies.at(-1).ok, false); assert.equal(f.searchCalls.length, 0)
  await f.request(view, 'models.chat', { providerId: 'p', modelId: 'm', webSearch: true, messages: [{ role: 'user', content: 'search' }] })
  assert.equal(f.replies.at(-1).ok, false); assert.equal(f.modelCalls.length, 0)
  await f.manager.install(pack({ version: '1.1.0', requiredCapabilities: ['storage:app', 'web:search'] })); view = await f.manager.open('notes')
  const input = { query: 'TypeScript', engine: 'bing', limit: 3 }
  await f.request(view, 'web.search', input)
  assert.deepEqual(f.searchCalls, [input]); assert.equal(f.replies.at(-1).value.engine, 'bing')
  await f.request(view, 'models.listProviders'); assert.equal(f.replies.at(-1).ok, false)
  let finish; f.search = () => new Promise(resolve => { finish = resolve })
  const start = f.replies.length, pending = f.request(view, 'web.search', input)
  await f.manager.setPermissions('notes', ['storage:app'])
  finish({ results: [{ title: 'late' }] }); await pending
  assert.equal(f.replies.slice(start).some(reply => reply.type === 'reply' && reply.ok), false)
  view = await f.manager.open('notes'); await f.request(view, 'web.search', input)
  assert.equal(f.replies.at(-1).ok, false); assert.equal(f.searchCalls.length, 2)
})

test('forwards autonomous web chat only when both model and search are approved', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack({ requiredCapabilities: ['models:generate', 'web:search'] }))
  const view = await f.manager.open('notes'), input = { providerId: 'p', modelId: 'm', webSearch: true, messages: [{ role: 'user', content: 'search' }] }
  await f.request(view, 'models.chat', input)
  assert.deepEqual(f.modelCalls, [['chat', input]]); assert.equal(f.replies.at(-1).ok, true)
})

test('model permission gates discovery and forwards selected model and complete conversation', async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); let view = await f.manager.open('notes')
  await f.request(view, 'models.listProviders')
  assert.deepEqual(f.replies.at(-1).value, [{ id: 'p', name: 'Provider' }])
  await f.request(view, 'models.listModels', { providerId: 'p' })
  assert.deepEqual(f.replies.at(-1).value, [{ id: 'm', name: 'Model' }])
  const input = { providerId: 'p', modelId: 'm', system: 'Concise', messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }, { role: 'user', content: 'Continue' }] }
  await f.request(view, 'models.chat', input)
  assert.equal(f.replies.at(-1).value.text, 'chat result')
  assert.deepEqual(f.modelCalls, [['providers'], ['models', 'p'], ['chat', input]])
  await f.manager.setPermissions('notes', ['storage:app']); view = await f.manager.open('notes')
  for (const method of ['models.listProviders', 'models.listModels', 'models.chat']) {
    await f.request(view, method, input); assert.equal(f.replies.at(-1).ok, false)
  }
  assert.equal(f.modelCalls.length, 3)
})

for (const method of ['models.generate', 'models.chat']) test(`revocation closes running views and suppresses delayed ${method} results`, async () => {
  const f = fixture(); await f.manager.initialize(); await f.manager.install(pack()); const view = await f.manager.open('notes')
  let finish; f.generate = f.chat = () => new Promise(resolve => { finish = resolve })
  const pending = f.request(view, method, { prompt: 'hello', providerId: 'p', modelId: 'm', messages: [{ role: 'user', content: 'hello' }] }); await f.manager.revoke('notes')
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
