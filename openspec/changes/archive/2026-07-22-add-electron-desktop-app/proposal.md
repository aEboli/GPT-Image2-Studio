## Why

当前 Windows 安装包虽然内置 Node.js 并可通过快捷方式启动，但仍会把工作台打开到默认浏览器中，缺少独立应用窗口、任务栏身份和随应用退出的服务生命周期。用户需要一个可以像普通 Windows 软件一样安装、启动、聚焦和卸载的桌面程序，同时继续使用现有完整本地工作流。

## What Changes

- 新增 Electron 桌面入口，在独立 `BrowserWindow` 中加载现有本地工作台，不复制或改写业务页面。
- 桌面应用在回环地址的动态端口启动现有 Node 服务，使用独立可写的应用数据目录，并在应用退出时关闭服务。
- 桌面应用只允许一个实例；重复启动时恢复并聚焦已有窗口。
- 桌面窗口禁用渲染进程 Node.js 集成、启用上下文隔离和沙箱，阻止非本地导航及任意新窗口，只把受信任的 HTTP(S) 外链交给系统浏览器。
- 新增 Electron Builder + NSIS Windows 安装包，提供应用图标、桌面/开始菜单快捷方式和标准卸载入口。
- 兼容的 IExpress 浏览器安装包改为在 staging 目录只安装生产依赖，避免把 Electron 桌面构建工具打入旧产物。
- 保留现有本地 Node.js、浏览器启动器、Cloudflare/Vercel 构建及 IExpress 安装包入口，不改变现有 API、生成流程和数据格式。
- 增加服务生命周期、桌面主进程、安全配置和打包内容测试，并更新中文使用与构建文档。

## Capabilities

### New Capabilities

- `desktop-application`: 规定独立桌面窗口、本地服务生命周期、单实例、安全导航和 Windows 安装包行为。

### Modified Capabilities

- 无。

## Impact

- 运行入口：新增 `desktop/` Electron 主进程；`server.mjs` 暴露可等待和关闭的服务实例，但命令行启动行为保持兼容。
- 构建与依赖：`package.json`、`package-lock.json` 新增 Electron、Electron Builder 和 NSIS 构建配置；新增桌面应用图标资产。
- 测试与文档：新增桌面运行时测试，更新 `README.md` 和 Windows 桌面安装说明。
- API 与数据：不新增远程 API，不修改现有请求、响应、配置或生成记录结构；桌面配置继续只保存在本机。
