import type { DirectoryGrant, MiraAppSdk, ViewRequest, AppMigration, AppOperation, ChatRequest, ModelRequest, WebSearchRequest } from '@mira/app-sdk'
import { capabilityLabels, compareVersions, inspectPackage, packagePath, parseManifest, type MiniappCapability, type MiniappManifest } from './package.ts'
import { readDistribution } from './distribution.ts'

export interface InstalledMiniapp { id: string; name: string; icon?: string; manifest: MiniappManifest; release: string; approved: MiniappCapability[]; reviewed: boolean; directories: DirectoryGrant[]; enabled: boolean }
interface Registry { version: 1; migrated: boolean; items: InstalledMiniapp[] }
export interface ReviewRequest { title: string; message: string; source?: string; permissions?: string[]; confirm: string }
const registryPath = 'miniapps/registry.json'
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
const decode = (data: Uint8Array) => JSON.parse(new TextDecoder().decode(data))

/** Workbench owns package policy, registry, lifecycle and every permission decision. */
export class MiniappManager {
  private state: Registry = { version: 1, migrated: false, items: [] }
  private readonly running = new Map<number, InstalledMiniapp>()
  private unsubscribe?: () => void
  private busy = false
  private dataQueue: Promise<unknown> = Promise.resolve()
  private readonly sdk: MiraAppSdk
  private readonly review: (request: ReviewRequest) => Promise<boolean>
  private readonly changed: (items: InstalledMiniapp[]) => void
  private readonly closed: (viewId: number) => void
  constructor(sdk: MiraAppSdk, review: (request: ReviewRequest) => Promise<boolean>, changed: (items: InstalledMiniapp[]) => void, closed: (viewId: number) => void) { this.sdk = sdk; this.review = review; this.changed = changed; this.closed = closed }
  private publish() { this.changed(this.state.items.map(item => ({ ...item, approved: [...item.approved], directories: [...item.directories] }))) }
  private persist() { return this.sdk.files.write({ path: registryPath, data: encode(this.state) }) }
  async initialize() {
    if ((await this.sdk.files.list({ path: 'miniapps' })).some(item => item.name === 'registry.json')) {
      const saved = decode(await this.sdk.files.read({ path: registryPath })) as Registry
      if (saved.version !== 1 || !Array.isArray(saved.items)) throw new Error('小程序注册表无效')
      const ids = new Set<string>()
      for (const item of saved.items) {
        const manifest = parseManifest(item.manifest); packagePath(item.release)
        if (item.id !== manifest.id || ids.has(item.id) || !item.release.startsWith(`miniapps/packages/${item.id}/`) || !Array.isArray(item.approved) || item.approved.some(cap => !manifest.requiredCapabilities.includes(cap)) || !Array.isArray(item.directories) || typeof item.reviewed !== 'boolean') throw new Error('小程序身份或权限记录无效')
        ids.add(item.id)
      }
      this.state = saved
    }
    this.unsubscribe?.()
    this.unsubscribe = this.sdk.views.subscribe(event => {
      if (event.event === 'views.request') void this.handleRequest(event.value as ViewRequest)
      if (event.event === 'views.closed') { const id = event.value.viewId; this.running.delete(id); this.closed(id) }
    })
    if (!this.state.migrated) {
      const legacy = await this.sdk.storage.legacyWorkbenchMiniapps()
      if (!Array.isArray(legacy)) throw new Error('旧小程序列表无效')
      for (const id of legacy) {
        if (this.state.items.some(item => item.id === id)) continue
        const bytes = await this.sdk.storage.legacyWorkbenchMiniapps(id)
        if (!(bytes instanceof Uint8Array)) throw new Error('旧小程序读取失败')
        await this.installPackage(bytes, true)
      }
      this.state.migrated = true; await this.persist()
    }
    this.publish()
  }
  private async exclusive<T>(operation: () => Promise<T>) {
    if (this.busy) throw new Error('正在处理小程序，请稍后重试')
    this.busy = true
    try { return await operation() } finally { this.busy = false }
  }
  async install(bytes: Uint8Array) { return this.exclusive(() => this.installPackage(bytes)) }
  async installFromUrl(url: string) {
    return this.exclusive(async () => {
      const context = await this.sdk.context.get()
      if (context.apiVersion.major !== 1 || context.apiVersion.minor < 4) throw new Error('网址安装需要 Mira API 1.4，请先更新 Mira')
      const result = await readDistribution(url, (value, kind) => this.sdk.workbench.fetchMiniappResource(value, kind))
      return this.installPackage(result.bytes, false, result.url)
    })
  }
  private async installPackage(bytes: Uint8Array, migrating = false, source?: string) {
    const { manifest, files } = inspectPackage(bytes), previous = this.state.items.find(item => item.id === manifest.id)
    if (previous && compareVersions(manifest.version, previous.manifest.version) <= 0) throw new Error('更新版本必须高于已安装版本')
    if (!migrating && !await this.review({ title: previous ? '更新小程序' : '安装小程序', message: `${manifest.name} ${manifest.version}${previous ? `（当前 ${previous.manifest.version}）` : ''}`, source, permissions: manifest.requiredCapabilities.map(cap => capabilityLabels[cap]), confirm: previous ? '更新并授权' : '安装并授权' })) return false
    const release = `miniapps/packages/${manifest.id}/${crypto.randomUUID()}`
    try {
      for (const [path, data] of Object.entries(files)) await this.sdk.files.write({ path: `${release}/${path}`, data })
      let icon: string | undefined
      if (manifest.icon && files[manifest.icon].length <= 1024 * 1024) {
        const ext = manifest.icon.split('.').pop()?.toLowerCase(), mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon' } as Record<string, string>)[ext || '']
        if (mime) { let binary = ''; for (const byte of files[manifest.icon]) binary += String.fromCharCode(byte); icon = `data:${mime};base64,${btoa(binary)}` }
      }
      if (previous) await this.stop(previous.id)
      const item: InstalledMiniapp = { id: manifest.id, name: manifest.name, manifest, release, icon, approved: migrating ? [] : manifest.requiredCapabilities, reviewed: !migrating, directories: previous?.directories ?? [], enabled: true }
      const before = this.state.items
      this.state.items = [...before.filter(entry => entry.id !== item.id), item]
      try { await this.persist() } catch (error) { this.state.items = before; throw error }
      this.publish()
    } catch (error) { await this.sdk.files.remove({ path: release }); throw error }
    // Old releases can be removed after the registry has committed the new version.
    if (previous) await this.sdk.files.remove({ path: previous.release }).catch(() => undefined)
    return true
  }
  private item(id: string) { const item = this.state.items.find(item => item.id === id); if (!item) throw new Error('小程序未安装'); return item }
  async open(id: string, duplicate = false) {
    return this.exclusive(() => this.openItem(id, duplicate))
  }
  private async openItem(id: string, duplicate: boolean) {
    const item = this.item(id)
    const existing = [...this.running].find(([, running]) => running === item)
    if (existing && !duplicate) return existing[0]
    if (!item.reviewed) {
      if (!await this.review({ title: '小程序权限', message: item.name, permissions: item.manifest.requiredCapabilities.map(cap => capabilityLabels[cap]), confirm: '允许并打开' })) return
      const before = { approved: item.approved, reviewed: item.reviewed }
      item.approved = [...item.manifest.requiredCapabilities]; item.reviewed = true
      try { await this.persist() } catch (error) { Object.assign(item, before); throw error }
      this.publish()
    }
    const key = duplicate ? `${item.id.slice(0, 27)}-${crypto.randomUUID()}` : item.id
    const idValue = await this.sdk.views.control({ type: 'open', key, directory: item.release, entry: item.manifest.entry })
    if (typeof idValue !== 'number') throw new Error('小程序视图创建失败')
    if (this.item(id) !== item || !item.reviewed) { await this.sdk.views.control({ type: 'close', id: idValue }); throw new Error('小程序已变化') }
    this.running.set(idValue, item); return idValue
  }
  async close(viewId: number) { this.running.delete(viewId); await this.sdk.views.control({ type: 'close', id: viewId }) }
  private async stop(id: string) { for (const [viewId, item] of this.running) if (item.id === id) await this.close(viewId) }
  async uninstall(id: string) {
    return this.exclusive(async () => {
      const item = this.item(id)
      await this.stop(id)
      const before = this.state.items; this.state.items = before.filter(item => item.id !== id)
      try { await this.persist() } catch (error) { this.state.items = before; throw error }
      this.publish()
      for (const grant of item.directories) await this.sdk.files.revoke(grant.id)
      await this.sdk.files.remove({ path: item.release }); return true
    })
  }
  async setPermissions(id: string, permissions: MiniappCapability[]) {
    return this.exclusive(async () => {
      const item = this.item(id)
      if (permissions.some(cap => !item.manifest.requiredCapabilities.includes(cap))) throw new Error('不能授权未声明的能力')
      if (permissions.some(cap => !item.approved.includes(cap)) && !await this.review({ title: '修改小程序权限', message: item.name, permissions: permissions.map(cap => capabilityLabels[cap]), confirm: '允许' })) return
      await this.stop(id)
      const before = { approved: item.approved, reviewed: item.reviewed }
      item.approved = [...permissions]; item.reviewed = true
      try { await this.persist() } catch (error) { Object.assign(item, before); throw error }
      this.publish()
    })
  }
  async revoke(id: string) { await this.setPermissions(id, []); this.item(id).reviewed = false; await this.persist(); this.publish() }
  async addDirectory(id: string, access: 'read' | 'readwrite') {
    return this.exclusive(async () => {
      const item = this.item(id)
      if (!item.approved.includes('files:read') || (access === 'readwrite' && !item.approved.includes('files:write'))) throw new Error('请先允许对应的文件读写能力')
      const grant = await this.sdk.files.selectDirectory(access)
      if (!grant) return
      item.directories.push(grant)
      try { await this.persist() } catch (error) { item.directories = item.directories.filter(item => item.id !== grant.id); await this.sdk.files.revoke(grant.id); throw error }
      this.publish()
    })
  }
  async removeDirectory(id: string, grantId: string) {
    return this.exclusive(async () => {
      const item = this.item(id); await this.stop(id)
      item.directories = item.directories.filter(grant => grant.id !== grantId); await this.persist(); this.publish(); await this.sdk.files.revoke(grantId)
    })
  }
  private assertRunning(viewId: number, item: InstalledMiniapp, capability?: MiniappCapability) {
    if (this.running.get(viewId) !== item || this.state.items.find(entry => entry.id === item.id) !== item || !item.reviewed || (capability && !item.approved.includes(capability))) throw new Error('小程序没有所需权限或授权已撤销')
  }
  async handleRequest(request: ViewRequest) {
    const item = this.running.get(request.viewId)
    try {
      if (!item) throw new Error('小程序会话无效')
      const value = await this.dispatch(request.viewId, item, request.method, request.params)
      this.assertRunning(request.viewId, item)
      await this.sdk.views.control({ type: 'reply', id: request.viewId, requestId: request.requestId, ok: true, value })
    } catch (error) {
      if (this.running.has(request.viewId)) await this.sdk.views.control({ type: 'reply', id: request.viewId, requestId: request.requestId, ok: false, error: error instanceof Error ? error.message : '小程序调用失败' }).catch(() => undefined)
    }
  }
  private async dispatch(viewId: number, item: InstalledMiniapp, method: string, params: unknown): Promise<unknown> {
    this.assertRunning(viewId, item)
    const input = (params ?? {}) as Record<string, any>
    if (method === 'files.directories') { this.assertRunning(viewId, item, 'files:read'); return item.directories.map(grant => ({ ...grant, access: item.approved.includes('files:write') ? grant.access : 'read' })) }
    if (method === 'context.get') return { appId: item.id, host: 'workbench', apiVersion: { major: 1, minor: 2 }, capabilities: [...item.approved] }
    const capability = ({ 'appearance.get': 'appearance:read', 'web.search': 'web:search', 'models.listProviders': 'models:generate', 'models.listModels': 'models:generate', 'models.chat': 'models:generate', 'models.generate': 'models:generate', 'notifications.send': 'notifications:send', 'storage.migrate': 'storage:app', 'storage.transaction': 'storage:app', 'files.read': 'files:read', 'files.list': 'files:read', 'files.write': 'files:write' } as Record<string, MiniappCapability>)[method]
    if (!capability) throw new Error('Workbench 不支持此小程序方法')
    this.assertRunning(viewId, item, capability)
    if (method === 'appearance.get') return this.sdk.appearance.get()
    if (method === 'web.search') return this.sdk.web.search(input as WebSearchRequest)
    if (method === 'models.listProviders') return this.sdk.models.listProviders()
    if (method === 'models.listModels') return this.sdk.models.listModels(input.providerId)
    if (method === 'models.chat') {
      if (input.webSearch) this.assertRunning(viewId, item, 'web:search')
      return this.sdk.models.chat(input as ChatRequest)
    }
    if (method === 'models.generate') return this.sdk.models.generate(input as ModelRequest)
    if (method === 'notifications.send') return this.sdk.notifications.send(input as { title: string })
    if (method === 'storage.migrate') return this.sdk.storage.migrate(input.migrations as AppMigration[], item.id)
    if (method === 'storage.transaction') return this.sdk.storage.transaction(input.operations as AppOperation[], item.id)
    let grant: DirectoryGrant | undefined
    if (input.grant !== undefined) {
      grant = item.directories.find(grant => grant.id === input.grant)
      if (!grant || (method === 'files.write' && grant.access !== 'readwrite')) throw new Error('此目录没有所需读写权限')
    }
    const path = input.path === '' && method === 'files.list' ? '' : packagePath(input.path)
    const location = grant ? { path, grant: grant.id } : { path: `miniapps/data/${item.id}${path ? '/' + path : ''}` }
    if (method === 'files.read') return this.sdk.files.read(location)
    if (method === 'files.list') return this.sdk.files.list(location)
    // Serialize writes and recheck immediately before mutation, including requests queued before revocation.
    const write = this.dataQueue.then(() => { this.assertRunning(viewId, item, capability); return this.sdk.files.write({ ...location, data: input.data }) })
    this.dataQueue = write.catch(() => undefined); return write
  }
  themeChanged(theme: 'light' | 'dark') {
    for (const [id, item] of this.running) if (item.approved.includes('appearance:read')) void this.sdk.views.control({ type: 'event', id, event: 'appearance.changed', value: theme }).catch(() => undefined)
  }
  async dispose() { this.unsubscribe?.(); for (const id of [...this.running.keys()]) await this.close(id) }
}
