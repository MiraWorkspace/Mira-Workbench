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

## 小程序连接

网页可以将 `@mira/app-sdk` 0.2.0 的客户端打包到小程序，使用 `connectMiraApp()` 建立兼容消息通道；此时对端为 **Workbench**，不是 Mira 平台分发器。`context.get()` 返回 `{ appId, host: 'workbench', apiVersion: { major: 1, minor: 0 }, capabilities }`。客户端名字保留传输兼容性，不代表小程序获得 Mira 身份。

| 声明能力 | 可调用方法 |
| --- | --- |
| `storage:app` | `storage.migrate`、`storage.transaction`，固定当前小程序 namespace，忽略调用者自报 namespace |
| `appearance:read` | `appearance.get/subscribe` |
| `models:generate` | `models.generate` |
| `notifications:send` | `notifications.send` |
| `files:read` | `files.read/list/directories` |
| `files:write` | `files.write` |

无 grant 的文件路径指向小程序私有文件区；带 grant 的路径仅可指向 Workbench 为该小程序保存的目录句柄。`files.directories()` 返回已授权目录句柄及只读/读写标记。小程序不能自行授予目录访问权，也不能申请其他小程序身份、外部绝对路径、Mira 子应用管理或任意视图。

用户在“设置 → 小程序权限”逐项管理能力，并选择只读或读写目录。即使声明了文件能力，也不等于获得整个文件系统的访问权。修改能力或撤销目录会关闭正在运行的视图；撤权后不会向小程序交还尚未完成的模型结果。

## 旧数据迁移

首次加载从只读兼容适配器导入旧 `.miniapps` 包和 SQLite 数据。原包和原数据库保留，迁移失败可重试；已存在的目标数据库不覆盖。旧 Mira 授权不继承，首次打开在 Workbench 重新审阅。测试版和正式版有独立文件区和数据 namespace。旧暂存更新仍保留在源目录，不自动激活。

## 本地验证

`npm test` 覆盖包路径校验、安装、更新失败回退、存储隔离、目录只读限制、越权拒绝、撤权与迟到结果。Mira 仓库的 `tests/workbenchPlatformElectron.test.ts` 使用临时用户目录验证实际 Workbench 页面、Mira 底层通道和隔离小程序页面。
