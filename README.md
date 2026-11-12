# Mira Workbench

Mira 的可选桌面子应用。首版聚合 17 个内置网站，提供搜索、分类、自定义网站、显示管理和内部网站标签。使用 Vue 3、TypeScript、Vite；品牌图标复用 Harness 使用的 `@lobehub/icons-static-svg`。

项目仓库：[MiraWorkspace/Mira-Workbench](https://github.com/MiraWorkspace/Mira-Workbench)。问题反馈请提交至 [Issues](https://github.com/MiraWorkspace/Mira-Workbench/issues)。

## 本地运行

```sh
git clone https://github.com/MiraWorkspace/Mira-Workbench.git
cd Mira-Workbench
npm ci
npm run dev
npm run build
```

开发端口以 Vite 启动输出为准；生产静态资源输出至 `dist/`。网站合集配置当前使用 localStorage 保存。

## Mira 内容区边界

```text
Mira 标题栏：原生窗口按钮 / 应用选择器 / 窗口级操作
└── 当前应用内容区：宽高由 Mira 提供
    └── Workbench
        ├── 44px 内部标签栏 / 显示管理 / 添加网站
        └── 合集首页，或网站工具栏与网页视图
```

切换应用时，Harness 的侧栏和任务区整体被替换。Workbench 不在 Harness 右侧任务面板中嵌套，也不重复绘制原生标题栏。根元素使用宿主分配的完整宽高；宿主容器需有确定高度，且在 flex 布局中允许内容区收缩。

合集内部滚动，标签栏保持可见；网站视图填满标签栏以下空间。网页承载、安全策略和宿主能力桥接仍需通过 Mira 的正式子应用契约接入。

## 已验证与待验收

2026-11-04 已完成：

- `npm run build` 通过，包含 TypeScript 检查和生产构建。
- Impeccable 静态检测未报告确定问题。
- 浏览器内容区 1440×860：17 个条目按 6 列排列，根文档无水平或垂直溢出。
- 浏览器内容区 1024×600：添加弹窗完整显示；显示管理列表内部滚动，底部操作可见。
- 搜索 DeepSeek 仅显示对应站点，搜索分类仅显示 Google。
- 可打开 ChatGPT、Gemini 两个标签，切回合集、关闭标签和回到合集正常；站点视图填满剩余高度。

以上是独立开发页的布局与交互结果，不代表已在 Mira 安装版完成验收。尚未验证 Electron 网站容器、登录/重定向/弹窗、切换标签后远端页面状态保留，以及 macOS/Windows 安装版表现。

## 在 Mira 中本地调试

```sh
npm run install:test
```

此命令先构建测试包，再复制至 `~/.mira/apps/mira-workbench-test/`。使用包含本地应用扫描功能的新版 Mira，进入“设置 → 应用扩展”即可自动识别，看到名称、Logo、版本和 DEV 标识，启用后可从标题栏选择器切换。Mira 重启也会自动扫描。脚本只覆盖同 ID 的测试目录，不覆盖正式版。

需要独立测试用户目录时，使用 `MIRA_TEST_HOME=/tmp/mira-workbench-local-20261104 npm run install:test`，并用相同环境变量启动 Mira。

`npm run build` 生成正式 ID `mira-workbench`；`npm run build:test` 生成 `mira-workbench-test` 且 `test: true`。两者均在 `dist/` 根目录生成 `app-manifest.json`，网站配置使用独立存储键。手动复制时，将整个 `dist/` 的内容放到 `~/.mira/apps/<清单id>/`，不要再嵌套一层 dist。

测试时注意：

- 推荐使用 `npm run install:test`，避免手动复制时目录名与清单 ID 不一致。Windows 上默认安装位置为 `%USERPROFILE%\.mira\apps\mira-workbench-test\`；macOS 上为 `~/.mira/apps/mira-workbench-test/`。
- 手动安装时，应用目录名必须与包内 `app-manifest.json` 的 `id` 完全一致，包括大小写。例如测试版目录必须是 `mira-workbench-test`，不能使用 `Mira-Workbench`。目录内应直接包含 `app-manifest.json`、`index.html`、图标文件和 `assets/`。
- 构建时清单由 `vite.config.ts` 生成，版本取自 `package.json`；修改项目根目录的 `app-manifest.json` 不会改变构建结果。检查 `dist/app-manifest.json` 以确认实际 ID、`test` 标志和图标路径。
- 如果应用显示 DEV 标识但图标缺失或“打开目录”失败，先检查目录名与清单 ID 是否一致，以及清单指定的入口和图标文件是否存在。修正后重新进入“设置 → 应用扩展”，必要时重启 Mira 重新扫描。
- Windows PowerShell 使用独立测试用户目录时，可先运行 `$env:MIRA_TEST_HOME = 'C:\mira-workbench-test'`，再执行 `npm run install:test`，并使用同一环境变量启动 Mira。

[Mira-Harness](https://github.com/MiraWorkspace/Mira-Harness) 提供本地应用扫描、静态入口、应用扩展设置页与标题栏选择器，并支持线上目录读取与缓存。线上下载安装与升级替换尚未接入。

2026-11-04 已在独立用户目录的 macOS Electron 中确认：设置和前台选择器识别测试包，切换后加载本地 Workbench 首页及 17 个网站卡片。此结果不代表远端网站登录或 Windows 安装版已通过。产品范围见 [PRD](PRD.md)。

## 小程序职责边界

Workbench 是自己的小程序宿主，管理安装、运行、能力与目录读写权限、更新和卸载。Mira 管理 Workbench 等第一方子应用，并通过通用 SDK 提供文件读写、SQLite namespace、隔离视图和消息通道。小程序不注册为 Mira 子应用，也不直接取得 Mira SDK 身份。开发指南与社区列表见 [Workbench Miniapps](https://github.com/MiraWorkspace/Mira-Workbench-miniapps)；宿主实现细节见 [Workbench 小程序 SDK](docs/MINIAPP_SDK.md)。

当前 Workbench 使用 SDK 0.4.0（GitHub 标签 `v0.4.0`）、Mira API 1.4，需要匹配更新的 Mira 底层。安装更新可即时生效；旧包和旧数据库只读迁移，原数据保留，权限在 Workbench 重新审阅。

支持从本地 `.miniapp` 文件或 HTTPS 发布清单地址安装小程序。在线清单与包经过同源、大小、SHA-256 和包内信息校验后，用户确认来源及权限再安装。官方示例安装地址：`https://miraworkspace.github.io/workbench-sdk-playground/manifest.json`；开发及发布规范见 [独立文档仓库](https://github.com/MiraWorkspace/Mira-Workbench-miniapps)。
