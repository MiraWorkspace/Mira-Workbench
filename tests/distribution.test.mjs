import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { readDistribution } from '../src/miniapps/distribution.ts'

const url = 'https://example.com/demo/manifest.json'
const manifest = { manifestVersion: 1, id: 'demo', name: 'Demo', version: '1.0.0', entry: 'index.html', requiredCapabilities: ['storage:app'], update: { url } }
async function fixture(changes = {}, packageChanges = {}, packageManifest = manifest) {
  const bytes = zipSync({ 'miniapp-manifest.json': strToU8(JSON.stringify(packageManifest)), 'index.html': strToU8('<h1>Demo</h1>') })
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')
  const document = { ...manifest, ...changes, package: { url: 'https://example.com/demo/releases/1.0.0/demo.miniapp', size: bytes.length, sha256, ...packageChanges } }
  const calls = []
  return { bytes, document, calls, read: async (value, kind) => { calls.push([value, kind]); return kind === 'manifest' ? strToU8(JSON.stringify(document)) : bytes } }
}
test('downloads a same-origin release and validates binary integrity and package identity', async () => {
  const f = await fixture()
  assert.deepEqual((await readDistribution(url, f.read)).bytes, f.bytes)
  assert.deepEqual(f.calls, [[url, 'manifest'], [f.document.package.url, 'package']])
})
test('rejects invalid source, remote package origin, invalid size or digest before downloading the package', async () => {
  for (const [changes, pkg] of [[{ update: { url: 'https://other.example/manifest.json' } }, {}], [{}, { url: 'https://cdn.example/demo.miniapp' }], [{}, { size: 0 }], [{}, { size: 64 * 1024 * 1024 + 1 }], [{}, { sha256: 'bad' }]]) {
    const f = await fixture(changes, pkg)
    await assert.rejects(readDistribution(url, f.read)); assert.equal(f.calls.length, 1)
  }
  const f = await fixture()
  await assert.rejects(readDistribution('http://example.com/manifest.json', f.read), /HTTPS/); assert.equal(f.calls.length, 0)
})
test('rejects tampered bytes, mismatched versions and permissions without returning an installable package', async () => {
  for (const f of [await fixture({}, { sha256: '0'.repeat(64) }), await fixture({}, { size: 1 }), await fixture({}, {}, { ...manifest, version: '2.0.0' }), await fixture({}, {}, { ...manifest, requiredCapabilities: ['models:generate'] })]) await assert.rejects(readDistribution(url, f.read))
})
test('reports HTML and malformed or oversized manifests as errors', async () => {
  for (const raw of [strToU8('<html>Github page</html>'), strToU8('null'), strToU8('{}'), new Uint8Array(65537)]) await assert.rejects(readDistribution(url, async () => raw))
})

test('online description must match the package description; old packages remain valid', async () => {
  const description = '了解 SDK 调用能力'
  const matching = await fixture({ description }, {}, { ...manifest, description })
  assert.deepEqual((await readDistribution(url, matching.read)).bytes, matching.bytes)
  for (const f of [await fixture({ description }), await fixture({}, {}, { ...manifest, description }), await fixture({ description }, {}, { ...manifest, description: '不同的功能说明' })]) await assert.rejects(readDistribution(url, f.read), /不一致/)
})
