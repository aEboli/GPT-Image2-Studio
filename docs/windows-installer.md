# Windows 安装包说明

`GPT-Image2-Studio-Setup-v0.1.5.exe` 是 Windows 自解压安装包，用系统自带 `iexpress.exe` 生成。

## 本次更新

- 安装包版本同步到 `0.1.5`，用于 GitHub Release 分发。
- 调用通道配置继续细化，直接调用模式可单独保存图片模型和视觉文本模型，接口地址可选择请求后缀并自动拆分供应商完整 URL。
- 队列任务会保存提交时的调用通道快照，并按模式和通道分别计算并发。
- 套图卡片新增排队中、生成中的稳定 loading 外观，减少批量生成时的布局跳动。
- 胶片栏增加加载、失败和空状态占位，历史缩略图加载过程更清晰。
- 图片编辑、局部蒙版、参考图角色分析、SKU 多件装 Listing 生成和套图记录细节继续完善。
- README 重排为快速启动、功能矩阵、配置、构建发布和 FAQ 结构。

> 高分辨率更容易触发上游生成失败、超时或无最终图片结果。日常使用建议优先选择 1K 和 2K 分辨率，需要更大尺寸时再逐档尝试。

## 安装内容

安装器会把工作台写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装内容包括本地 Web 服务、浏览器工作台、文档、示例文件、当前 `node_modules/` 依赖和一个内置 `node.exe` 运行时。用户无需额外安装 Node.js 即可启动。

## 启动方式

安装完成后可以通过桌面或开始菜单里的 `GPT-Image2-Studio.cmd` 启动。启动脚本会自动选择可用端口，启动本地服务，并打开浏览器。

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

如果供应商复制给你的是完整地址，例如 `https://vendor.example/openai/v1/responses` 或 `https://vendor.example/openai/v1/images/generations`，可以直接粘贴到接口地址输入框。Studio 保存时会识别末尾的 `responses`、`chat/completions`、`images/generations`、`images/edits`，自动拆成 Base URL 和接口后缀，并保存到当前通道配置里；URL 里的查询参数和 hash 不会保存。遇到无法识别的末尾路径时，Studio 会把整段当作 Base URL，并在缺少 `/v1` 时自动补上 `/v1`。

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
