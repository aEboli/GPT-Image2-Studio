## 迁移判断

| 类别 | 当前情况 | 最小迁移策略与验证 |
| --- | --- | --- |
| 项目启动器 | PowerShell 启动 cmd，再启动 Node；20 秒等待后仍会打开浏览器 | 7.4+、严格模式，明确进程失败；测试复用、端口冲突、超时、不提前打开浏览器和环境隔离 |
| Native Messaging | 已有严格模式、HKCU 和无 BOM manifest；脚本有 UTF-8 BOM | 增加运行时和 Windows 声明；不为移除脚本 BOM 而改编码，区分脚本与 manifest；隔离注册表命令测试 |
| 图片资源 | Node 导入和输出目录依赖当前目录；Dispose 只在成功路径执行 | 锚定脚本根目录、检查退出码和输出目录、try/finally；临时目录比较 PNG 像素与清单 |
| CMD 包装器 | 直接调用 powershell，启动器不转发参数 | pwsh.exe、统一开关、存在性检查、参数转发和退出码；测试路径含空格/中文及缺失运行时 |
| Node 构建中的 PowerShell | 仅生成 install.cmd 的无 tar 解压分支使用旧运行时 | 保留 tar 分支；回退检查 7.4+，显式捕获解压错误；通过环境变量或脚本参数传递路径，避免单引号注入 |
| 纯 CMD 停止服务 | 无 PowerShell 调用 | 保留原文件和行为，仅检查契约 |
| 文档与 CI | windows-latest，未显式声明 shell 与最低版本 | 文档区分开发脚本、扩展助手安装和纯 Electron 运行；CI 显式 pwsh，运行版本/AST/行为检查 |

## 官方依据

- [Windows PowerShell 与 PowerShell 7 的差异](https://learn.microsoft.com/en-us/powershell/scripting/whats-new/differences-from-windows-powershell?view=powershell-7.4)：可执行文件从 powershell 改为 pwsh，可并存；.NET Framework 与现代 .NET 存在类型/重载差异；Invoke-WebRequest 仅提供基本解析。健康检查只读取 HTTP 状态码，不依赖旧 IE 对象。
- [Start-Process 7.4](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-7.4)：`-Environment` 在 7.4 引入，可用 null 移除子进程环境变量；ArgumentList 外层引号不会传入子进程，含空格的参数必须显式引用。选择 7.4 为最低版本符合用户边界，并允许直接控制 PORT 与 mock 变量。
- [字符编码](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-7.4)：PowerShell 6+ 默认 UTF-8 无 BOM；保留原有安装/卸载脚本的 BOM，但 manifest 明确无 BOM。
- [System.Drawing Windows 限制](https://learn.microsoft.com/en-us/dotnet/core/compatibility/core-libraries/6.0/system-drawing-common-windows-only)：保持 Windows 限制。本机 7.6.5 实测发现 AddPolygon 对 Object[] 的绑定失败，显式 Point[] 后与 5.1 生成的 60 个 PNG 逐字节一致。
- 运行时使用 7.4 已公开的 API；实际执行覆盖 7.6.5，没有将其宣称为 7.4 实测。

## 实现补充

启动器直接用 Start-Process 启动 Node，以 Environment 传递 PORT 并移除 mock 变量，避免 cmd 命令拼接。后台进程使用隐藏窗口，进程提前退出与健康超时均明确失败；不再创建原来的常驻 cmd 控制台。Root/Port、端口选择和浏览器工作台保持原契约。

## 测试设计

- 保留现有 Node 测试结构，新增可观察行为断言，不仅替换字符串正则。PowerShell 执行使用独立进程和临时副本，测试不能真实打开浏览器或杀死用户服务。
- Native Messaging 在独立 PowerShell 进程内替换注册表命令，记录调用并断言 HKCU 精确路径；LOCALAPPDATA 指向测试临时目录，文件复制和 manifest 写入可真实执行。任何遗漏的真实注册表调用必须被测试拦截；缺失 EXE 时不得写注册表。
- 资源基线和迁移后运行均在临时副本内；比较文件名、PNG 尺寸与解码像素，不在仓库资源目录重生成；注入 Node 失败、输出目录缺失及绘图失败验证错误和释放。
- 安装包解压用临时 ZIP、临时目标目录和替身启动入口验证；不执行面向真实用户目录的安装。
- 最低版本优先以独立 7.4 运行时验证；若环境只有 7.6，明确记录 7.4 未实测，不能伪称已覆盖。
- 构建产物仅作为忽略目录中的验证输出，不纳入迁移文件范围。IExpress 已在现有文档中记录历史失败，实际运行后独立归因。

## 成功标准

所有自有 PowerShell 调用使用 pwsh，缺失或旧版本明确失败；四个脚本 AST 无错误；既有启动/Native/资源/安装输出契约通过行为测试；全量测试、模块同步、发布检查、OpenSpec 严格校验及 diff 检查通过或逐项说明已有失败；可用时执行桌面冒烟和两种构建。只保留必要变更，确认中文编码正常，最后同步规范并归档。
