import { distributionUrl, inspectPackage, parseManifest } from './package.ts'

export type MiniappResourceReader = (url: string, kind: 'manifest' | 'package') => Promise<Uint8Array>

export async function readDistribution(value: string, read: MiniappResourceReader) {
  const url = distributionUrl(value), raw = await read(url, 'manifest')
  if (!raw.length || raw.length > 65536) throw new Error('发布清单不能为空或超过 64 KB')
  let data: Record<string, unknown>
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) }
  catch { throw new Error('安装地址未返回有效的 JSON 发布清单，请使用 manifest.json 的直接地址') }
  const manifest = parseManifest(data)
  if (!manifest.update || manifest.update.url !== url) throw new Error('发布清单的 update.url 必须与当前安装地址一致')
  const pkg = data.package as Record<string, unknown> | undefined
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('发布清单缺少 package 下载信息')
  const packageUrl = distributionUrl(pkg.url)
  if (new URL(packageUrl).origin !== new URL(url).origin) throw new Error('安装包与发布清单必须使用相同的 HTTPS 来源')
  if (typeof pkg.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(pkg.sha256)) throw new Error('发布清单缺少有效的 package.sha256')
  if (!Number.isSafeInteger(pkg.size) || (pkg.size as number) <= 0 || (pkg.size as number) > 64 * 1024 * 1024) throw new Error('发布清单的 package.size 必须在 1 字节至 64 MB 之间')
  const bytes = await read(packageUrl, 'package')
  if (bytes.length !== pkg.size) throw new Error('安装包大小与发布清单不一致，请联系发布者')
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join('')
  if (digest !== pkg.sha256.toLowerCase()) throw new Error('安装包 SHA-256 校验失败，请联系发布者')
  if (JSON.stringify(inspectPackage(bytes).manifest) !== JSON.stringify(manifest)) throw new Error('包内名称、简介、版本、入口、权限或更新信息与发布清单不一致')
  return { bytes, url }
}
