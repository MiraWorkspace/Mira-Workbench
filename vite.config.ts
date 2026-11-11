import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import pkg from './package.json'

export default defineConfig(({ mode }) => {
  const test = mode === 'test'
  const appId = test ? 'mira-workbench-test' : 'mira-workbench'
  return {
  plugins: [vue(), {
    name: 'mira-app-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-manifest.json', source: JSON.stringify({
        manifestVersion: 1, id: appId, name: 'Mira Workbench', version: pkg.version,
        description: '聚合常用 AI 网站与搜索工具，支持自定义网站和内部标签页。',
        icon: 'mira-workbench-logo.png', entry: 'index.html', test,
        minShellVersion: '0.1.0-beta.1', platformApi: { major: 1, minor: 3 }, requiredCapabilities: ['storage:app', 'appearance:read', 'workbench:manage', 'files:app', 'views:create', 'models:generate', 'web:search', 'notifications:send'],
      }, null, 2) + '\n' })
    },
  }],
  define: { __MIRA_APP_ID__: JSON.stringify(appId) },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  }
})
