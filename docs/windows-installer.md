# Windows 安装包说明

`GPT-Image2-Studio-Setup-v0.2.8.exe` 是 Windows 自解压安装包，由系统自带 `iexpress.exe` 生成，用于 GitHub Release 分发。

这个兼容安装包启动后会在默认浏览器中打开工作台。需要独立窗口、任务栏身份和标准 NSIS 卸载体验时，请使用 [Windows 桌面程序](./windows-desktop.md)。

## 安装内容

安装器会把工作台写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装内容包括本地 Web 服务、浏览器工作台、文档、示例文件、当前 `node_modules/` 依赖和内置 `node.exe` 运行时。用户不需要额外安装 Node.js。

## 启动方式

安装完成后可通过桌面或开始菜单里的 `GPT-Image2-Studio.cmd` 启动。启动脚本会自动选择可用端口，启动本地服务，并打开浏览器。

## 本地数据

API Key 和私有配置只保存在本机。服务端配置默认位于：

```text
%LOCALAPPDATA%\GPT-Image2-Studio\.local\config.json
```

生成图片默认保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

PPT、套图、写真和文章插图会在日期目录和 `Pictures\json\` 下保存各自记录。卸载时可直接删除 `%LOCALAPPDATA%\GPT-Image2-Studio`；如需清理生成图片，请手动删除对应日期目录。

## 接口地址

安装包里的配置面板会把接口地址拆成 `Base URL + 接口后缀` 保存。常见后缀包括：

| 后缀 | 用途 |
| --- | --- |
| `responses` | 路由模式默认值，适合 Responses 风格接口。 |
| `chat/completions` | 适合只提供 Chat Completions 兼容协议的服务。 |
| `images/generations` | 直接调用模式默认值，适合标准图片生成端点。 |
| `images/edits` | 图片编辑专用端点，普通生图不需要手动选择。 |

如果供应商给的是完整 URL，Studio 会尽量自动拆分出 Base URL 和接口后缀；无法识别时会把整段地址作为 Base URL 保留。

## Node DNS fallback

本地 Node 服务启动时会保留系统默认 `dns.lookup` 路径。只有当系统解析上游域名失败时，才会按顺序尝试 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器。安装包会继承启动环境变量，因此发布后仍可用环境变量调整这项行为。

- 设置 `IMAGE_STUDIO_DISABLE_DNS_FALLBACK=1` 可禁用 fallback。
- 设置 `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` 可自定义 DNS 服务器列表，多个地址可用逗号、分号或空白分隔。

如果需要排查 DNS 配置或端口占用问题，可以在安装目录里用命令行运行 `GPT-Image2-Studio.cmd` 查看启动输出。

## 发布校验

发布前建议运行：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run build:installer
git diff --check
```

安装包不应包含 `.env`、`.env.*`、`.local/`、`output/`、`artifacts/`、日志文件或本机调试快照；`.env.example` 只作为示例模板保留。
