export type SiteCategory = 'assistant' | 'search'

export interface WebsiteEntry {
  id: string
  name: string
  url: string
  category: SiteCategory
  brand?: string
  builtin: boolean
  visible: boolean
}

export const builtinSites: WebsiteEntry[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', category: 'assistant', brand: 'openai', builtin: true, visible: true },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', category: 'assistant', brand: 'gemini', builtin: true, visible: true },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/', category: 'assistant', brand: 'deepseek', builtin: true, visible: true },
  { id: 'zhipu', name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail', category: 'assistant', brand: 'zhipu', builtin: true, visible: true },
  { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/', category: 'assistant', brand: 'kimi', builtin: true, visible: true },
  { id: 'qwen', name: '通义千问', url: 'https://www.qianwen.com/', category: 'assistant', brand: 'qwen', builtin: true, visible: true },
  { id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat/', category: 'assistant', brand: 'doubao', builtin: true, visible: true },
  { id: 'minimax', name: 'MiniMax', url: 'https://agent.minimax.cn/', category: 'assistant', brand: 'minimax', builtin: true, visible: true },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/', category: 'assistant', brand: 'claude', builtin: true, visible: true },
  { id: 'google', name: 'Google', url: 'https://google.com/', category: 'search', brand: 'google', builtin: true, visible: true },
  { id: 'wenxin', name: '文心一言', url: 'https://wenxin.baidu.com/', category: 'assistant', brand: 'wenxin', builtin: true, visible: true },
  { id: 'yuanbao', name: '腾讯元宝', url: 'https://yuanbao.tencent.com/', category: 'assistant', brand: 'yuanbao', builtin: true, visible: true },
  { id: 'xinghuo', name: '讯飞星火', url: 'https://xinghuo.xfyun.cn/desk', category: 'assistant', brand: 'spark', builtin: true, visible: true },
  { id: 'nami', name: '纳米AI', url: 'https://bot.n.cn/', category: 'assistant', builtin: true, visible: true },
  { id: 'tiangong', name: '天工AI', url: 'https://www.tiangong.cn/', category: 'assistant', brand: 'tiangong', builtin: true, visible: true },
  { id: 'xiaoyi', name: '小艺', url: 'https://xiaoyi.huawei.com/chat/', category: 'assistant', brand: 'huawei', builtin: true, visible: true },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/', category: 'assistant', brand: 'grok', builtin: true, visible: true },
]

export const sitesStorageKey = `${__MIRA_APP_ID__}.sites.v1`

export function readSites(): WebsiteEntry[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(sitesStorageKey) || 'null')
    if (!Array.isArray(stored)) return structuredClone(builtinSites)
    const entries = stored.filter((entry): entry is WebsiteEntry =>
      Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.url === 'string' && ['assistant', 'search'].includes(entry.category)),
    )
    return entries.length ? entries : structuredClone(builtinSites)
  } catch {
    return structuredClone(builtinSites)
  }
}
