# GPT-Image2-Studio

> 本项目是一个本地优先的 AI 图像创作工作台。它面向提示词生图、参考图分析、局部修图、电商套图、人物写真、文章插图、PPT 生成和素材画廊管理，把常用图像工作流集中在一个浏览器界面中。

当前版本：`v0.2.0`

## 重要说明

- README 不包含私人截图、真实生成图片、真实 API Key、账号信息或本机用户目录。
- 示例路径统一使用占位符，例如 `%USERPROFILE%` 和 `<your-api-key>`。
- 本仓库不会提交 `.env`、`.local/`、`output/`、`artifacts/`、生成历史和本机调试文件。
- 如果你使用第三方或私有中转服务，模型名称、计费方式和路由识别能力以服务提供方为准。

## 项目定位

GPT-Image2-Studio 适合需要批量制作视觉素材的个人创作者、运营同学、产品设计师和内容团队。它不是只做单张图片的表单，而是把参考图、提示词、参数、队列、历史记录、输出目录和多种创作模式组织到同一个 Studio。

核心目标：

- 本地优先：API 配置、生成记录和输出文件默认保存在本机。
- 多通道兼容：支持 Responses 风格路由、直接图片生成接口，以及兼容 Gemini 图像协议的中转通道。
- 工作流导向：覆盖普通生图、风格迁移、局部编辑、套图、写真、文章插图、PPT 和素材复用。
- 可部署：同一套前端和共享逻辑可运行在本地 Node、Cloudflare Pages Worker 或 Vercel。
- 可验证：仓库包含 Node test、`public/lib` 同步检查、Cloudflare Pages 构建和 Windows 安装包构建脚本。

## 快速开始

### 本地开发启动

```powershell
git clone https://github.com/aEboli/GPT-Image2-Studio.git
cd GPT-Image2-Studio
cmd /c npm ci
cmd /c npm start
```

启动后打开：

```text
http://localhost:3600
```

如果 `3600` 端口被占用：

```powershell
$env:PORT="3601"
cmd /c npm start
```

Windows 下也可以双击：

```text
launch-studio.cmd
```

停止本地服务：

```text
stop-studio-services.cmd
```

### Windows 安装包

GitHub Release 的 Windows 安装包文件名为：

```text
GPT-Image2-Studio-Setup-v0.2.0.exe
```

安装后默认写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装包内置 `runtime\node.exe`，普通用户不需要额外安装 Node.js。

### 环境变量

仓库提供 `.env.example` 作为模板：

```text
OPENAI_API_KEY=<your-api-key>
OPENAI_BASE_URL=https://api.openai.com/v1
RESPONSES_MODEL=gpt-5.4

IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0
IMAGE_STUDIO_DNS_FALLBACK_SERVERS=
```

真实 `.env` 不要提交到 Git。云端部署请使用平台的 Secret 或环境变量配置。

### Node DNS fallback

本地 Node 服务启动时会保留系统默认 `dns.lookup` 路径。只有当系统解析上游域名失败时，才会按顺序尝试 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器，用于降低部分网络环境下访问上游 API 时的解析失败概率。

- 设置 `IMAGE_STUDIO_DISABLE_DNS_FALLBACK=1` 可禁用 fallback。
- 设置 `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` 可自定义 DNS 服务器列表，多个地址可用逗号、分号或空白分隔。

## 界面导览

### 全局界面

| 界面 | 入口 | 用途 |
| --- | --- | --- |
| 顶部导航 | 页面顶部 | 按“创作、资产、配置”组织所有模式，适合在不同工作流之间快速切换。 |
| API 配置面板 | 顶部“配置”按钮 | 配置 Base URL、API Key、接口后缀、模型、调用通道和连接测试。 |
| 生成日志 | 配置菜单中的“生成日志” | 查看当前会话的任务状态、调用通道、队列进度和错误信息。 |
| Prompt Kit | 提示词区域的模板入口 | 管理常用提示词片段，帮助快速拼装画面主体、风格、镜头和质量描述。 |
| 图片转提示词 | 顶部“图片转提示词”按钮 | 上传参考图并生成可复用提示词，适合反推构图、风格和主体描述。 |
| 输出目录入口 | 顶部“打开输出目录”按钮 | 本地运行时快速打开生成结果所在文件夹。 |

### 创作界面

| 界面 | 路由 | 用途 |
| --- | --- | --- |
| 提示词生图 | `/#studio` | 默认创作入口。支持最多 15 张参考图、提示词增强、比例、分辨率、输出格式和实时预览。 |
| 风格迁移 | `/#style-transfer` | 上传原图和风格参考图，或选择内置风格预设，在保留主体内容的同时迁移视觉风格。 |
| 融图分析 / 参考图分析 | `/#reference-analysis` | 先分析多张参考图的主体、风格、用途和组合关系，再生成更稳的目标提示词。 |
| 图片拆解 | `/#image-decomposition` | 把产品图、设备图或包装图拆成结构化说明图，适合做卖点图和信息图。 |
| 图片编辑 | `/#image-edit` | 上传源图进行整图编辑，也可用画布蒙版圈选多个局部区域并分别填写修改指令。 |
| 快速融图 | `/#quick-blend` | 按 A/B/C/D 分组上传素材，按同序号配对生成融合图，适合批量组合产品和场景。 |
| 图片压缩 | `/#image-compress` | 在浏览器本地压缩、改尺寸和转换格式，不需要把图片发送到服务端。 |
| 电商套图 | `/#creation` | 为单个商品规划并生成 4 到 18 张营销图，包含类目模板、SKU、Logo、补图队列和 Listing Agent。 |
| 写真模式 | `/#portrait` | 使用人物、动作、服装道具和地点配置生成系列写真、头像或形象照。 |
| 文章插图 | `/#article-illustration` | 解析文章包，生成风格设定、角色/场景设定和正式插图计划。 |
| PPT 生成 | `/#ppt` | 从文档或主题生成演示文稿图片页，支持逐页补图、编辑、普通 PPTX 和可编辑重建导出。 |

### 资产与记录界面

| 界面 | 路由 | 用途 |
| --- | --- | --- |
| 瀑布画廊 | `/#gallery` | 浏览普通生图、风格迁移、参考图分析、图片拆解、图片编辑和快速融图结果。 |
| 文章插图记录 | `/#article-record` | 管理文章插图历史，继续失败项、复制提示词或导出记录。 |
| 套图记录 | `/#creation-record` | 管理电商套图历史，查看单图状态、继续补图、导出清单和查看 Listing 草稿。 |
| 写真记录 | `/#portrait-record` | 管理写真历史，筛选记录、查看生成结果并重试失败图片。 |
| PPT 记录 | `/#ppt-record` | 查看 PPT 生成历史，打开幻灯片结果并下载生成文件。 |

### 弹窗与辅助界面

| 界面 | 入口 | 用途 |
| --- | --- | --- |
| 图片详情灯箱 | 点击预览图或画廊图片 | 放大查看生成结果，支持缩放、适配、平移、下载和参数复盘。 |
| PPT 单页编辑器 | PPT 结果页的单页编辑入口 | 对单页幻灯片追加标注或修改指令，并重新生成当前页。 |
| 写真搭配库 | 写真模式中的服装/道具/地点选择区域 | 选择内置服装、配饰、动作和地点资产，组合成写真生成计划。 |
| Logo 素材库 | 套图模式的 Logo 相关入口 | 保存和复用常用 Logo，用于电商套图或批量加 Logo 工作流。 |
| 模型选择器 | API 配置面板中的模型列表入口 | 拉取或手动选择当前通道的图像模型、文本模型和兼容协议模型。 |

## API 与调用通道

Studio 会把请求配置拆成 `Base URL + 接口后缀`，方便连接官方接口、兼容网关或私有中转。

| 通道 | 适合场景 | 主要配置 |
| --- | --- | --- |
| 路由模式 | 通过 Responses 风格接口调用图像工具 | Base URL、API Key、`responses` 后缀、Responses 模型 |
| 直接调用模式 | 连接兼容图片生成端点 | Base URL、API Key、`images/generations` / `responses` / `chat/completions` 后缀、图像模型 |
| 兼容协议模式 | 连接兼容 Gemini 图像协议的中转服务 | Base URL、API Key、图像模型、分辨率模式 |

常见接口后缀：

```text
responses
chat/completions
images/generations
images/edits
```

如果供应商给的是完整 URL，例如：

```text
https://vendor.example/openai/v1/images/generations
```

可以直接粘贴到地址输入框。Studio 会尽量拆分为：

```text
Base URL: https://vendor.example/openai/v1
接口后缀: images/generations
```

## 输出与本地数据

本地服务默认把图片结果保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

不同工作流会写入独立子目录，例如：

```text
YYYY-MM-DD-prompt\
YYYY-MM-DD-style-transfer\
YYYY-MM-DD-reference-analysis\
YYYY-MM-DD-image-decomposition\
YYYY-MM-DD-image-edit\
YYYY-MM-DD-quick-blend\
YYYY-MM-DD-creation\
YYYY-MM-DD-portrait\
YYYY-MM-DD-article\
YYYY-MM-DD-ppt\
```

记录索引默认写入：

```text
%USERPROFILE%\Pictures\json\
```

本地服务端配置默认位于：

```text
.local/config.json
```

## 参数与限制

| 项目 | 当前限制 |
| --- | --- |
| 普通参考图 | 最多 15 张 |
| 参考图分析 | 最多 15 张 |
| 风格迁移 | 原图 1 张，风格图 1 张或内置预设 |
| 图片编辑源图 | 1 张 |
| 图片编辑局部蒙版 | 每个源图最大 50 MB，源图和 mask 会规范化为同尺寸 PNG |
| 快速融图 | A/B 必选，C/D 可选，按同序号配对 |
| 电商套图参考图 | 最多 15 张 |
| 电商套图风格参考图 | 最多 3 张，且与普通参考图合计最多 15 张 |
| 写真人物参考图 | 最多 3 张 |
| 写真动作参考图 | 最多 3 张 |
| 写真服装/道具/配饰参考图 | 最多 9 张 |
| 写真计划数量 | 1 到 100 张 |
| PPT 页数 | 1 到 20 页 |
| 输出格式 | PNG / JPG |

常用比例包括：

```text
1:1, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5,
16:9, 9:16, 21:9, 9:21, 2:1, 1:2, 3:1, 1:3
```

高分辨率更容易触发上游超时、失败或无最终图片结果。日常建议先使用自动适配或中等尺寸，确认画面方向后再提高分辨率。

## 部署与构建

### Cloudflare Pages

```powershell
cmd /c npm run build:pages
```

构建产物写入：

```text
dist/
```

仓库包含：

```text
wrangler.jsonc
wrangler.api.jsonc
cloudflare-pages-worker.mjs
cloudflare-r2-lifecycle.json
```

部署前请在 Cloudflare 中配置 API Key、Base URL、模型和 R2/Queue 绑定。

### Vercel

仓库包含 `vercel.json`，可以导入仓库后按 Vercel 项目流程部署，也可以使用：

```powershell
vercel deploy --prod
```

### Windows 安装包

```powershell
cmd /c npm run build:installer
```

产物路径格式：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.2.0.exe
```

更多说明见 [docs/windows-installer.md](./docs/windows-installer.md)。

## 验证命令

发布前建议运行：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run build:pages
git diff --check
```

需要验证 Windows 安装包时再运行：

```powershell
cmd /c npm run build:installer
```

## 项目结构

```text
GPT-Image2-Studio/
|-- docs/                         # 文档、安装说明和执行记录
|-- examples/                     # API 请求和 SSE 示例
|-- lib/                          # 本地服务和前端共享逻辑
|-- openspec/                     # 规格变更、设计和验收场景
|-- public/                       # 浏览器工作台、样式、前端模块和内置资产
|-- scripts/                      # 构建、打包和 public/lib 同步脚本
|-- test/                         # Node test 测试
|-- cloudflare-pages-worker.mjs   # Cloudflare Pages API Worker
|-- generate-image.mjs            # 命令行单图生成入口
|-- server.mjs                    # 本地 Web 服务入口
|-- launch-studio.cmd             # Windows 快速启动器
|-- launch-studio.ps1             # Windows PowerShell 启动器
|-- stop-studio-services.cmd      # 停止本地服务脚本
|-- wrangler.jsonc                # Cloudflare Pages 配置
|-- wrangler.api.jsonc            # Worker API 配置
|-- vercel.json                   # Vercel 配置
|-- package-lock.json
`-- package.json
```

## 发布检查清单

- `package.json` 和 `package-lock.json` 版本已更新到 `0.2.0`。
- README 和 Windows 安装包说明已同步到 `v0.2.0`。
- README 不包含私人截图、真实用户目录、真实密钥或生成历史。
- 本地测试、构建或可替代验证已执行并记录结果。
- GitHub tag 使用 `v0.2.0`，Release 标题使用 `GPT-Image2-Studio v0.2.0`。
