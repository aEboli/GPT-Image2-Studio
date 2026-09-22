## Why

项目自有 Windows 启动器、Native Messaging 包装器和兼容安装包的解压回退仍调用 Windows PowerShell 5.1。将这些入口统一到 PowerShell 7.4+，明确运行时、编码和失败边界，同时保持 Node.js、Electron、浏览器工作台和 Native Messaging 协议不变。

## What Changes

- **BREAKING**：项目自有 PowerShell 脚本最低版本为 Windows 上的 PowerShell 7.4；不支持 5.1、7.0、7.2，不静默回退。纯 Node/Electron 入口及纯 CMD 停止脚本不新增此依赖。
- 三个 CMD 包装器使用 `pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File`，转发参数，检查脚本和运行时是否存在，保存并返回失败退出码；缺失运行时明确提示安装 PowerShell 7.4+。
- 四个现有 PowerShell 脚本声明最低版本、严格模式、终止错误策略及 Windows 限制；检查外部命令状态，按脚本目录解析内部路径。
- 启动器保留 `-Root`、`-Port`、默认 3600、50 个候选端口、监听端口快照、原健康接口和 mock 环境变量清理；仅健康成功后打开浏览器，启动失败或超时返回非零。
- Native Messaging 保持 HKCU、Chrome/Edge 路径、固定 host/扩展 ID/allowed_origins、安装目录、固定 EXE 和 UTF-8 无 BOM manifest，无提权要求。
- 资源生成保持颜色映射、文件名、目录和 PNG 内容；修复当前目录依赖、Node 失败漏检和异常时绘图资源释放。
- IExpress 保留 tar 优先和 Expand-Archive 回退；回退使用 PowerShell 7.4+，路径不直接嵌入 PowerShell 字符串。保持包名、目录、快捷方式和内置 Node 启动方式。
- 文档说明适用入口和安装要求；Windows CI 显式使用 pwsh，检查最低版本和脚本行为。

## Capabilities

### New Capabilities

- `windows-powershell-runtime`: 项目拥有的 Windows 脚本运行时、CMD 失败契约、Native Messaging、资源生成和安装包兼容约束。

### Modified Capabilities

无。继续遵守 `local-server-launch` 与 `desktop-application` 的现有要求。

## Impact

- 实现范围：`launch-studio.ps1/.cmd`、`scripts/generate-portrait-accessory-color-assets.ps1`、Native Messaging 的两个 `.ps1` 和两个 `.cmd`、`scripts/build-windows-installer.mjs`。
- 测试范围：现有启动器、Native Messaging 测试及必要的 Windows 运行时/安装包/资源回归测试。
- 文档范围：两份 README、`docs/windows-desktop.md`、`docs/windows-installer.md`、扩展 README；CI 为 `.github/workflows/ci.yml`。
- `stop-studio-services.cmd` 保留，不重写：默认 3600–3606、自定义端口、`taskkill /T /F` 和现有失败提示/退出行为。审查发现其当前顶层始终返回 0，本变更不额外修正此历史语义。
- 不升级依赖，不修改业务模块，不迁移模型，不修改第三方脚本或已有生成资源，不提交或发布。

## Approval

状态：用户已于 2026-09-20 回复“确认”，实现获得授权。
