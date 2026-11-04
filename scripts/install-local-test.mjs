import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'dist')
const manifest = JSON.parse(readFileSync(join(source, 'app-manifest.json'), 'utf8'))
if (manifest.id !== 'mira-workbench-test' || manifest.test !== true) throw new Error('仅允许安装测试构建，请先运行 npm run build:test')
const testHome = process.env.MIRA_TEST_HOME ? resolve(process.env.MIRA_TEST_HOME) : homedir()
const target = join(testHome, '.mira', 'apps', manifest.id)
if (existsSync(target)) {
  const previous = JSON.parse(readFileSync(join(target, 'app-manifest.json'), 'utf8'))
  if (previous.id !== manifest.id || previous.test !== true) throw new Error('目标目录不是同一测试应用，已保留原目录')
}
mkdirSync(dirname(target), { recursive: true })
cpSync(source, target, { recursive: true })
console.log(`已安装测试应用：${target}\n进入新版 Mira 的设置 → 应用扩展，即会自动扫描。`)
