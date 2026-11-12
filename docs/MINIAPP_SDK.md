# Workbench 小程序宿主与 SDK

Workbench 是小程序宿主。包校验、注册表、生命周期、能力授权和目录读写权限位于 `src/miniapps/`；Mira 仅通过通用 SDK 提供文件、SQLite namespace、隔离视图和原生能力。

## 安装包

`.miniapp` 或 `.zip`，根目录包含 `miniapp-manifest.json`（兼容旧的 `app-manifest.json`）。不执行后台进程、安装脚本或原生模块。最小示例：

```json
{
  "manifestVersion": 1,
  "id": "notes",
  "name": "笔记",
  "version": "1.0.0",
  "entry": "index.html",
  "requiredCapabilities": ["storage:app", "files:read", "files:write"]
}
```

可选 `icon` 是包内图片路径。安装包上限 64 MiB，解压上限 256 MiB、10000 项。校验路径、重复路径、保留 ID、版本和权限列表；不接受 Mira 管理权限或创建更多视图的能力。小程序不是 Mira 第一方子应用。

同 ID 的较高 SemVer 版本执行更新，用户确认所需权限后，先写入独立版本目录，再关闭旧视图并原子提交注册表。文件写入或注册表失败保留原版本。更新无需重启 Mira。卸载关闭视图、撤销目录句柄、删除当前版本，保留独立业务数据。重新安装不会恢复已撤销的目录授权。

注册表和包位于 Workbench 自己的应用文件区：`miniapps/registry.json`、`miniapps/packages/<id>/<release>/`；私有文件位于 `miniapps/data/<id>/`。SQLite 使用 Workbench 内部以小程序 id 命名的 namespace，不使用 Mira 应用身份。

## 从网址安装与发布

在“添加 → 小程序 → 从网址安装”粘贴开发者提供的 **manifest.json 的 HTTPS 直接地址**。Workbench 下载清单和安装包，核对大小、SHA-256 与包内清单，再展示来源及申请权限；确认后沿用本地安装的更新与回滚流程。失败或取消不会替换已安装版本。

线上发布沿用 [Cherry Studio 的分发思路](https://github.com/CherryHQ/cherry-studio-miniapps/blob/main/README.zh-CN.md)：开发者自行托管静态文件，通过 GitHub Topic `workbench-miniapp` 发现项目。在线清单包含完整的包内清单字段，并增加 `package`：

```json
{
  "manifestVersion": 1,
  "id": "demo",
  "name": "演示小程序",
  "version": "1.0.0",
  "entry": "index.html",
  "requiredCapabilities": ["storage:app"],
  "update": { "url": "https://example.com/demo/manifest.json" },
  "package": {
    "url": "https://example.com/demo/releases/1.0.0/demo.miniapp",
    "sha256": "填写实际安装包的64位十六进制SHA256摘要",
    "size": 12345
  }
}
```

- 包内 `miniapp-manifest.json` 也包含相同的 `update.url`，不包含 `package`。支持的名称、版本、入口、图标、权限及更新地址必须与在线清单一致。
- `update.url` 必须等于用户输入的安装地址；清单和包使用同一 HTTPS origin，不含账号密码或 URL 片段，不接受重定向。不能直接使用 GitHub 仓库网页或会重定向的 Release 附件地址；推荐 GitHub Pages 或静态文件服务器。
- 清单最多 64 KiB，包最多 64 MiB；`size` 是下载包的字节数，`sha256` 根据最终包计算。使用按版本分隔的包路径，已发布的版本文件保持不变。
- Workbench 通过 SDK 0.4.0 的 `workbench.fetchMiniappResource(url, kind)` 调用 Mira API 1.4 的受限下载接口。接口仅向 Workbench 开放，不提供给小程序；Mira 限制 HTTPS、重定向、大小及超时，并拒绝已识别的本机/内网地址。安装规则和权限决策仍属于 Workbench。
- 当前通过重新提交清单地址手动安装较高 SemVer 版本；不自动检查或下载更新。

官方可运行示例与发布脚本：[workbench-sdk-playground](https://github.com/MiraWorkspace/workbench-sdk-playground)。安装地址：`https://miraworkspace.github.io/workbench-sdk-playground/manifest.json`。

## 小程序连接

网页可以将 `@mira/app-sdk` 0.4.0 的客户端打包到小程序，使用 `connectMiraApp()` 建立兼容消息通道；此时对端为 **Workbench**，不是 Mira 平台分发器。`context.get()` 返回 `{ appId, host: 'workbench', apiVersion: { major: 1, minor: 2 }, capabilities }`。客户端名字保留传输兼容性，不代表小程序获得 Mira 身份。

| 声明能力 | 可调用方法 |
| --- | --- |
| `storage:app` | `storage.migrate`、`storage.transaction`，固定当前小程序 namespace，忽略调用者自报 namespace |
| `appearance:read` | `appearance.get/subscribe` |
| `models:generate` | `models.listProviders/listModels/chat/generate` |
| `web:search` | `web.search`，允许 `models.chat({ webSearch: true })` 搜索和读取公开网页 |
| `notifications:send` | `notifications.send` |
| `files:read` | `files.read/list/directories` |
| `files:write` | `files.write` |

无 grant 的文件路径指向小程序私有文件区；带 grant 的路径仅可指向 Workbench 为该小程序保存的目录句柄。`files.directories()` 返回已授权目录句柄及只读/读写标记。小程序不能自行授予目录访问权，也不能申请其他小程序身份、外部绝对路径、Mira 子应用管理或任意视图。

用户在“设置 → 小程序权限”逐项管理能力，并选择只读或读写目录。即使声明了文件能力，也不等于获得整个文件系统的访问权。修改能力或撤销目录会关闭正在运行的视图；撤权后不会向小程序交还尚未完成的模型结果。

## 供应商、模型与对话

公开客户端方法与类型统一维护在 [Mira-App-SDK](https://github.com/MiraWorkspace/Mira-App-SDK)。Workbench 依赖该 SDK 来调用 Mira；小程序如复用同一客户端，仅复用消息运输，对端仍是 Workbench。调用链为：小程序 → Workbench 逐次校验权限 → Workbench 的 Mira SDK → Mira 宿主模型服务。小程序不能传入密钥、API 地址或身份来替换宿主配置。

当前使用 SDK 0.4.0、Mira API 1.4 和 Workbench 小程序 API 1.2。SDK 0.4.0 已通过 GitHub 标签 `v0.4.0` 分发，尚未发布到 npm。依赖固定为 `github:MiraWorkspace/Mira-App-SDK#v0.4.0`，锁文件记录确切提交，不再使用临时本地包。更新小程序前，需要更新 Mira 与 Workbench，不能只替换网页中的 SDK 文件。

```ts
const providers = await sdk.models.listProviders()
// 让用户从列表选择 providerId，再加载模型列表。
const models = await sdk.models.listModels(providerId)
// 让用户选择 modelId；每次发送完整历史。
const result = await sdk.models.chat({
  providerId, modelId,
  messages: [
    { role: 'user', content: '我叫小明。' },
    { role: 'assistant', content: '你好，小明。' },
    { role: 'user', content: '我叫什么？' },
  ],
})
```

列表只返回配置可用、已启用聊天供应商/模型的 `{ id, name }`，不返回密钥与地址，也不发起生成请求。`chat` 必须显式选择供应商和模型，不依赖全局默认模型；历史仅支持 `user/assistant` 非空文本，可另传非空 `system`。首条和最后一条必须为用户消息，每次最多 100 条消息、合计 100000 字符（含系统提示）。返回 `{ text }` 完整回答，由小程序自行维护历史；暂不提供流式、附件和任意工具注册。

保留 `generate({ prompt, providerId?, modelId? })`，不传选择时使用 Mira 默认模型，显式选择需同时提供两个 ID。模型失败返回安全提示；Workbench 自有视图拒绝请求时，客户端收到 `APPLICATION_DENIED`，其 message 包含可展示的原因。撤权关闭视图并丢弃迟到回答，已经发起的供应商请求可能继续执行。

## AI 自主联网

普通小程序只需要传联网开关，不需要选择搜索引擎：

```ts
const answer = await sdk.models.chat({
  providerId, modelId, webSearch: true,
  messages: [{ role: 'user', content: '搜索并阅读 TypeScript 官方文档后解释。' }],
})
// answer.text 为最终回答；answer.sources 的 index 对应回答中的 [[source:N]]。
```

小程序需声明并获准 `models:generate` 和 `web:search`。Workbench 对联网请求同时检查两项权限；Mira 在每个模型轮次、工具和网络请求前及结果交付前再次校验 Workbench 的真实会话。

AI 决定查询词、读取网页和是否继续检索；宿主自动选择搜索源、并发回退。同一批最多 3 个搜索/网页读取任务并行，每次对话最多 6 次模型调用、8 次工具执行、总预算 60 秒；SDK 等待至少 75 秒。模型需要支持工具调用，联网可能增加调用费用。关闭联网时保持普通文本对话。开启只表示允许，模型不一定每个问题都搜索。

另外提供独立 `sdk.web.search({ query, limit? })`，适合只展示结构化搜索结果的应用，无需模型权限。`query` 最长 2000 字符，`limit` 默认 5、整数 1–10；默认自动搜索源。可选 `engine` 仅供诊断或定向调用，普通对话界面无需暴露。返回 `{ query, engine, results: [{ title, url, snippet? }], attempts: [{ engine, status, durationMs }] }`；搜索源错误使用安全提示，不返回原始服务错误。单次搜索预算 25 秒，SDK 等待至少 35 秒。

`sources` 记录本轮工具发现的来源，包含搜索结果及页面链接，不代表全部链接均读过正文；来源编号每次请求重新生成。小程序应把来源绑定在对应回答上。搜索结果和网页正文是外部资料，不应执行其中的指令。联网不授予终端、本机文件或任意工具访问权。

## 旧数据迁移

首次加载从只读兼容适配器导入旧 `.miniapps` 包和 SQLite 数据。原包和原数据库保留，迁移失败可重试；已存在的目标数据库不覆盖。旧 Mira 授权不继承，首次打开在 Workbench 重新审阅。测试版和正式版有独立文件区和数据 namespace。旧暂存更新仍保留在源目录，不自动激活。

## 本地验证

`npm test` 覆盖分发清单、同源限制、摘要/大小/包内信息校验、网址安装取消、旧宿主提示、包路径校验、安装、更新失败回退、存储隔离、目录只读限制、越权拒绝、撤权与迟到结果。Mira 仓库的 `tests/workbenchPlatformElectron.test.ts` 使用临时用户目录验证实际 Workbench 页面、Mira 底层通道和隔离小程序页面。
