# Windows 安装包说明

`GPT-Image2-Studio-Setup-v0.1.7.exe` 是 Windows 自解压安装包，用系统自带 `iexpress.exe` 生成。

## 本次更新

- 当前安装包文件名为 `GPT-Image2-Studio-Setup-v0.1.7.exe`，用于 GitHub Release 分发。
- 套图参考图分析继续完善，分析结果会保留商品分组标签，并可更稳定地回填商品名、四级类目和参考用途。
- 新增套图参考图专用灯箱入口，参考图卡片可直接查看大图，并复用缩放、拖拽、复制和打开路径能力。
- 四级类目模板和套图规划提示词继续补全，主图、卖点图、场景图、SKU 补图和 Listing 证据的职责更清晰。
- 套图卡片、胶片栏和预览区继续优化 loading、排队中、失败和空状态，减少批量生成时的布局跳动。
- README 与 Windows 安装包说明已同步到当前 `v0.1.7` 功能。

> 高分辨率更容易触发上游生成失败、超时或无最终图片结果。日常使用建议优先选择 1K 和 2K 分辨率，需要更大尺寸时再逐档尝试。

## 安装内容

安装器会把工作台写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装内容包括本地 Web 服务、浏览器工作台、文档、示例文件、当前 `node_modules/` 依赖和一个内置 `node.exe` 运行时。用户无需额外安装 Node.js 即可启动。

## 启动方式

安装完成后可以通过桌面或开始菜单里的 `GPT-Image2-Studio.cmd` 启动。启动脚本会自动选择可用端口，启动本地服务，并打开浏览器。

## Node DNS fallback

安装包内置的本地 Node 服务启动时会保留系统默认 `dns.lookup` 路径；只有当系统解析上游域名失败时，才会按顺序使用 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器再尝试一次，用于降低部分网络环境下访问上游 API 时的解析失败概率。安装包会继承启动环境变量，因此发布后仍可用环境变量调整这项行为。

- 设置 `IMAGE_STUDIO_DISABLE_DNS_FALLBACK=1` 会禁用该 fallback，并保持 Node 原始 DNS 服务器列表。
- 设置 `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` 可自定义服务器列表，多个地址用逗号、分号或空白分隔；自定义列表会替代默认的 `223.5.5.5`、`1.1.1.1`，但仍保留系统已有 DNS 服务器作为后续回退。
- 如果 DNS 配置失败，命令行启动日志会输出 `DNS fallback 配置失败：...`，服务会继续启动；这通常表示自定义服务器格式不被当前 Node 运行时接受。桌面或开始菜单启动会隐藏服务子进程日志，排查时可在安装目录里用命令行运行 `GPT-Image2-Studio.cmd`。

## 本地数据

API Key 和配置只保存在本机。服务端保存的配置位于安装目录下，浏览器私有配置会保存在当前浏览器的本地配置中：

```text
%LOCALAPPDATA%\GPT-Image2-Studio\.local\config.json
```

## 接口后缀与完整 URL

安装包里的配置面板把接口地址拆成两部分保存：左侧输入框保存 Base URL，右侧下拉框保存请求后缀。一般只需要把地址填到 `/v1`，例如 `https://api.openai.com/v1`。

| 后缀 | 适用场景 |
| --- | --- |
| `responses` | 路由模式默认值，通过 Responses API 的 `image_generation` 工具完成生图和多步流程。 |
| `chat/completions` | 供应商只兼容 Chat Completions 风格的视觉/生图协议时使用；路由模式和直接调用模式都可以用。 |
| `images/generations` | 直接调用模式默认值，适合标准图片生成端点。 |
| `images/edits` | 图片编辑专用端点。普通生图不要选它；图片编辑页会在上传源图或 mask 时自动调用 `/images/edits`。 |

如果供应商复制给你的是完整地址，例如 `https://vendor.example/openai/v1/responses` 或 `https://vendor.example/openai/v1/images/generations`，可以直接粘贴到接口地址输入框。Studio 保存时会识别末尾的 `responses`、`chat/completions`、`images/generations`、`images/edits`，自动拆成 Base URL 和接口后缀，并保存到当前通道配置里；URL 里的查询参数和 hash 不会保存。遇到无法识别的末尾路径时，Studio 会把整段当作 Base URL，保留供应商给出的路径，不再额外补 `/v1`。

生成图片保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

PPT 工作流生成的幻灯片图片和 `.pptx` 文件也保存到日期目录，PPT 历史清单保存到：

```text
%USERPROFILE%\Pictures\json\ppt-decks\
```

卸载时可直接删除 `%LOCALAPPDATA%\GPT-Image2-Studio`。如果也要清理生成图片，请手动删除对应日期的图片目录。

## 发布校验

发布前建议确认：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run build:pages
cmd /c npm run build:installer
git diff --check
```

安装包不包含 `.local/`、真实 `.env` / `.env.*`、`output/`、`artifacts/`、日志文件和本地调试快照；会包含 `.env.example` 作为环境变量示例模板。
