const extensions: Record<string, string> = { chatgpt: 'png', claude: 'png', deepseek: 'svg', doubao: 'png', gemini: 'png', google: 'svg', grok: 'png', kimi: 'ico', minimax: 'png', nami: 'svg', qwen: 'png', tiangong: 'png', wenxin: 'ico', xiaoyi: 'png', xinghuo: 'ico', yuanbao: 'png', zhipu: 'png' }

export function siteIconUrl(site: { brand?: string; customIcon?: string; cachedIcon?: string; favicon?: string | null }) {
  const brandIcon = site.brand && extensions[site.brand] ? `${import.meta.env.BASE_URL}favicons/${site.brand}.${extensions[site.brand]}` : undefined
  return site.customIcon || site.cachedIcon || brandIcon || site.favicon || undefined
}
