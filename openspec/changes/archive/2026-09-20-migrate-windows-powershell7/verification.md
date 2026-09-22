# PowerShell 7 迁移验证记录

日期：2026-09-20。范围仅限项目自有 Windows 脚本、包装器、构建解压、测试、文档和 CI。用户已确认提案。

## 运行时边界

- 迁移前：三个 CMD 包装器和 IExpress 的无 tar 解压分支调用 Windows PowerShell；脚本没有统一最低版本。
- 迁移后：四个自有脚本要求 Windows + PowerShell 7.4+；CMD 使用 pwsh.exe，无旧版回退。缺少脚本返回 2，缺少运行时返回 9009，脚本失败保留其状态码。
- 纯 Node/Electron、已安装的 Native Messaging EXE、停止服务 CMD 不增加 PowerShell 依赖。IExpress 有 tar 时仍直接使用 tar。
- 实测 PowerShell 7.6.5，Windows PowerShell 5.1.26100.9444，Node v24.19.0，npm 11.17.0。7.4 最低版本由公开 API 和 Requires 约束确认，未在单独的 7.4 运行时执行。

## 迁移前基线

| 命令 | 结果 |
| --- | --- |
| pwsh --version | 成功，7.6.5 |
| powershell --version | 失败：Windows PowerShell 将 --version 当作表达式解析；改用 PSVersionTable 确认 5.1.26100.9444 |
| node --version | 成功，v24.19.0 |
| npm --version | 成功，11.17.0 |
| npm test | 2372/2372 通过 |
| npm run sync:public-lib -- --check | 通过，120 个模块 |
| npm run check:release | 通过，v0.2.19 |
| npx --no-install openspec validate --all --strict | 59/59 通过 |
| git diff --check | 通过，仅 Git 行尾提示 |

开始时已有 22 个跟踪文件的未提交状态及一个未跟踪归档目录；均未覆盖或回滚。特别保留 package.json/package-lock.json 既有修改，未升级任何依赖。

## 本次文件及目的

| 文件 | 修改目的 |
| --- | --- |
| launch-studio.ps1 | 7.4/Windows 声明、严格模式、直接启动 Node、独立子进程环境、提前退出和超时失败、就绪后打开浏览器 |
| launch-studio.cmd | pwsh 定位、参数转发、缺失检查、退出码 |
| extensions/product-image-collector/native-host/install-native-host.ps1 | 最低版本、Windows 与 LOCALAPPDATA 检查 |
| extensions/product-image-collector/native-host/uninstall-native-host.ps1 | 同上，保持固定卸载范围 |
| extensions/product-image-collector/native-host/install-native-host.cmd | PS7 包装器和失败传播 |
| extensions/product-image-collector/native-host/uninstall-native-host.cmd | PS7 包装器和失败传播 |
| scripts/generate-portrait-accessory-color-assets.ps1 | 脚本目录定位、Node 失败检测、Point[] 重载绑定、绘图资源 finally 释放 |
| scripts/build-windows-installer.mjs | PS7 回退解压、通过环境传递 ZIP 路径、解压失败非零 |
| test/launcher.test.mjs | 更新 Node 进程与环境约束 |
| test/product-image-native-host.test.mjs | 版本/Windows/HKCU 非提权约束 |
| test/windows-powershell.test.mjs | AST、CMD 参数与失败、启动器模拟和真实 Node、隔离安装/卸载、资源和解压行为测试 |
| README.md、README.zh-CN.md | 运行时要求、安装链接、适用边界与命令 |
| docs/windows-desktop.md | 桌面程序与脚本运行时边界 |
| docs/windows-installer.md | tar/PS7 回退与失败说明 |
| extensions/product-image-collector/README.md | 助手安装/卸载要求 |
| .github/workflows/ci.yml | 显式 pwsh 与最低版本检查，现有 npm test 包含新增测试 |
| 本 change 及 windows-powershell-runtime 主规范 | 提案、决策、可验证要求、任务和验证记录 |

## 保持行为与兼容性变化

保持默认 3600、50 个候选端口、监听快照、固定健康接口、仅复用健康 Studio、Root/Port、server.mjs 和 mock 清理。保持 Native Messaging host/扩展 ID/allowed_origins、Chrome/Edge HKCU、固定 EXE、原目录和 manifest 无 BOM。保留原脚本 BOM。保留 PNG 文件名/颜色/目录/格式；60 个临时生成文件与 Windows PowerShell 5.1 基线逐字节一致，未改仓库图片。

停止服务 CMD 没有变更，默认 3600–3606、自定义端口、taskkill /T /F 与已有失败提示/退出码保留。IExpress 包名、目录、快捷方式及安装后的 Node 启动入口保留。

必要变化：不再接受 PowerShell 5.1/7.0/7.2；启动超时不打开浏览器并返回非零；Node 后台隐藏运行，不再创建 cmd 控制台；缺失运行时/脚本和解压失败可可靠识别。

## 验证与限制

- 四个脚本通过 PS7 AST；源码扫描未发现项目脚本或构建器调用旧 PowerShell。
- Native Messaging 测试在独立进程卸载 HKCU PSDrive，并拦截精确注册表命令，LOCALAPPDATA 指向临时目录；没有修改真实用户注册表或安装目录。
- CMD 在含中文、空格、单引号的临时目录验证参数、42 状态码、缺脚本与缺 pwsh。
- 资源脚本从外部当前目录运行成功；缺目录、Node 失败明确报错。原脚本在 7.6 下存在 AddPolygon 绑定失败且返回成功的问题，迁移已修复。
- npm run test:desktop-smoke：成功。
- npm run build:desktop：成功，生成原名称的 v0.2.19 x64 NSIS 安装包。构建器报告依赖重复引用，没有阻止构建。
- npm run build:installer：失败，退出码 1；依赖暂存和 payload.zip 已完成，iexpress.exe /N 返回 1，stdout/stderr 为空。既有 docs/windows-installer.md 已记录持续 IExpress 失败；该阶段未执行本次 PS7 回退命令，不把它归为 PS7 解压回归。未修复与迁移无关的 IExpress 发布问题。
- 未实际向用户目录安装任一安装包；回退 Expand-Archive 在临时 ZIP 和目录完成成功/失败测试。未在 PS7.4 独立运行时实测。
