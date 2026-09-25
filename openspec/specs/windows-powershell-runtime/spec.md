# windows-powershell-runtime Specification

## Purpose
TBD - created by archiving change migrate-windows-powershell7. Update Purpose after archive.
## Requirements
### Requirement: Windows scripts use an explicit supported runtime
项目自有 Windows PowerShell 脚本 SHALL 要求 PowerShell 7.4 或更高版本，启用严格模式与终止错误策略，检测 Windows，且不得回退到 Windows PowerShell 5。

#### Scenario: Runtime is missing or unsupported
- **WHEN** 用户通过 CMD 入口运行脚本但找不到 pwsh.exe，或使用低于 7.4 的运行时
- **THEN** 入口或脚本明确报告所需版本并返回非零退出码
- **AND** 不启动 Windows PowerShell 5

### Requirement: CMD wrappers preserve arguments and failures
项目自有 PowerShell CMD 包装器 SHALL 检查目标脚本，使用 pwsh.exe 的 -NoLogo、-NoProfile、-ExecutionPolicy Bypass 和 -File，正确转发参数并保留失败退出码。

#### Scenario: Script path includes spaces or Chinese characters
- **WHEN** 用户从任意当前目录运行位于含空格或中文路径下的包装器并传入参数
- **THEN** 包装器定位其相邻脚本，正确传入参数并返回脚本状态

#### Scenario: Target script is missing
- **WHEN** 包装器的目标脚本不存在
- **THEN** 包装器显示清晰错误并返回非零退出码

### Requirement: Browser launcher preserves Studio discovery
启动器 SHALL 保留 Root 与 Port 参数、默认端口 3600、从请求端口起的 50 个候选端口、单次监听快照和 /api/article-illustration/sets 健康检查，只复用通过检查的服务，并清理 IMAGE_STUDIO_MOCK_IMAGE_GENERATION。

#### Scenario: Existing service or port conflict
- **WHEN** 请求端口已占用
- **THEN** 启动器仅复用健康检查成功的 Studio，否则选择范围内首个可用端口启动 server.mjs
- **AND** 新启动的 Studio 进程映像名为 `image-studio.exe`，使端口面板显示 `image-studio`

#### Scenario: Server cannot become ready
- **WHEN** 进程启动失败或服务未在启动期限内通过健康检查
- **THEN** 启动器显示明确失败并返回非零状态
- **AND** 仅在服务健康就绪后才打开浏览器

### Requirement: Native Messaging identity and user scope are preserved
安装和卸载 SHALL 保留 Chrome 与 Edge 的 HKCU 注册表路径、host 名称 com.aeboli.gpt_image2_studio.product_image_clipboard、扩展 ID gbdkgkooddcicpkikaklapgeakhjjcan 及对应 allowed_origins、LOCALAPPDATA 下 GPT-Image2-Studio/ProductImageClipboardHost 目录，无管理员权限要求且不修改协议。

#### Scenario: Install and uninstall the host
- **WHEN** 用户安装后卸载助手
- **THEN** 安装复制固定 ProductImageClipboardHost.exe 并写入 UTF-8 无 BOM manifest
- **AND** 卸载只清理对应注册表项和安装目录

#### Scenario: Packaged executable is missing
- **WHEN** 安装源中缺少固定 EXE
- **THEN** 安装明确失败且不创建注册表项

### Requirement: Asset generation remains reproducible on Windows
图片资源生成脚本 SHALL 根据脚本目录定位项目，保留颜色映射、现有输出目录、文件名和 PNG 图像结果，检查 Node 退出状态、输出目录，并在成功和异常路径释放自行创建的绘图资源。

#### Scenario: Generation runs outside the repository directory
- **WHEN** 用户从其他当前目录运行资源生成脚本
- **THEN** 脚本读取相同资源定义并输出相同 PNG 图像结果

#### Scenario: Generation fails
- **WHEN** Node 失败、输出目录不存在或绘制/保存异常
- **THEN** 脚本报告明确错误并失败，已分配的可释放绘图资源被释放

### Requirement: Distribution and pure CMD behavior remain compatible
安装包 SHALL 保持包名、发布目录、安装目录、快捷方式和内置 Node 启动契约，保留 tar 解压与 PowerShell 7.4+ Expand-Archive 回退。纯 Node/Electron 运行与停止服务 CMD SHALL 不因迁移而要求 PowerShell。

#### Scenario: Installer needs archive fallback
- **WHEN** 系统没有 tar.exe
- **THEN** 安装器使用 pwsh.exe 执行 Expand-Archive，缺失或低版本运行时以及解压失败均返回非零
- **AND** 含空格、中文或单引号的路径作为数据正确传递

#### Scenario: User stops local services
- **WHEN** 用户运行 stop-studio-services.cmd
- **THEN** 默认处理 3600 到 3606 或用户传入端口，保持 taskkill /T /F、失败提示和既有退出行为

### Requirement: Runtime boundary is documented and tested
文档和 Windows CI SHALL 明确 PowerShell 7.4+ 的适用入口，并验证自有脚本的语法、运行时和失败行为；Native Messaging 测试 SHALL 不写真实用户注册表或用户安装目录。

#### Scenario: Maintainer validates the migration
- **WHEN** 维护者运行规定验证流程
- **THEN** 执行 PS7 AST、行为测试、全量 Node 测试、模块同步检查、发布检查和 OpenSpec 严格校验
- **AND** 如实记录实际运行时版本、构建结果和环境限制
