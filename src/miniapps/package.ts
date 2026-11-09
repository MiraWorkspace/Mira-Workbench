import { unzipSync } from 'fflate'
export const miniappCapabilities = ['storage:app', 'appearance:read', 'models:generate', 'notifications:send', 'files:read', 'files:write'] as const
export type MiniappCapability = typeof miniappCapabilities[number]
export const capabilityLabels: Record<MiniappCapability, string> = {
  'storage:app': '读写此小程序的独立数据', 'appearance:read': '读取并跟随主题', 'models:generate': '调用模型（可能产生费用）', 'notifications:send': '发送通知', 'files:read': '读取你授权的目录', 'files:write': '修改你授权的目录',
}
export interface MiniappManifest { manifestVersion: 1; id: string; name: string; version: string; entry: string; icon?: string; requiredCapabilities: MiniappCapability[] }
export function packagePath(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 512 || /[\\\x00-\x1f:]/.test(value) || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('包内路径无效')
  return value
}
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
export function compareVersions(a: string, b: string): number {
  const x = versionPattern.exec(a), y = versionPattern.exec(b)
  if (!x || !y) throw new Error('版本必须使用 SemVer 格式')
  for (let i = 1; i <= 3; i++) if (BigInt(x[i]) !== BigInt(y[i])) return BigInt(x[i]) > BigInt(y[i]) ? 1 : -1
  if (x[4] === y[4]) return 0
  if (!x[4] || !y[4]) return x[4] ? -1 : 1
  const left = x[4].split('.'), right = y[4].split('.')
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] === right[i]) continue
    if (left[i] === undefined || right[i] === undefined) return left[i] === undefined ? -1 : 1
    const numericLeft = /^\d+$/.test(left[i]), numericRight = /^\d+$/.test(right[i])
    if (numericLeft !== numericRight) return numericLeft ? -1 : 1
    return numericLeft ? (BigInt(left[i]) > BigInt(right[i]) ? 1 : -1) : (left[i] > right[i] ? 1 : -1)
  }
  return 0
}
export function parseManifest(value: unknown): MiniappManifest {
  const item = value as Record<string, unknown>
  if (!item || item.manifestVersion !== 1 || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(item.id) || ['mira-workbench', 'mira-workbench-test', 'mira-harness'].includes(item.id)) throw new Error('小程序清单或 ID 无效')
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 || /[\x00-\x1f\x7f]/.test(item.name)) throw new Error('小程序名称无效')
  if (typeof item.version !== 'string') throw new Error('小程序版本无效')
  compareVersions(item.version, item.version)
  if (item.test) throw new Error('不能安装测试应用')
  const requested = item.requiredCapabilities
  if (!Array.isArray(requested) || requested.some(cap => !miniappCapabilities.includes(cap)) || new Set(requested).size !== requested.length) throw new Error('小程序申请了不支持的权限')
  return { manifestVersion: 1, id: item.id, name: item.name.trim(), version: item.version, entry: packagePath(item.entry), ...(item.icon ? { icon: packagePath(item.icon) } : {}), requiredCapabilities: [...requested].sort() }
}
export function inspectPackage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 64 * 1024 * 1024) throw new Error('安装包不能超过 64 MB')
  let size = 0, count = 0
  const paths = new Set<string>()
  const files = unzipSync(bytes, { filter: file => {
    const path = packagePath(file.name.replace(/\/$/, '')), key = path.toLowerCase()
    if (paths.has(key)) throw new Error('安装包包含重复路径')
    paths.add(key); size += file.originalSize
    if (++count > 10000 || size > 256 * 1024 * 1024) throw new Error('安装包解压后过大')
    return !file.name.endsWith('/')
  } })
  const source = files['miniapp-manifest.json'] ?? files['app-manifest.json']
  if (!source || source.length > 65536) throw new Error('缺少小程序清单或清单超过 64 KB')
  const manifest = parseManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(source)))
  if (!files[manifest.entry] || (manifest.icon && !files[manifest.icon])) throw new Error('清单指定的入口或图标不存在')
  return { manifest, files }
}
