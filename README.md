# GPT-Image2-Studio

<div align="center">

[![Version](https://img.shields.io/badge/version-v0.2.1-2563eb.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages%20Ready-f38020.svg)](https://pages.cloudflare.com/)
[![Windows](https://img.shields.io/badge/Windows-Installer-0078d4.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases)

**本地优先的 AI 图像生成与视觉创作工作台**

把提示词生图、参考图分析、图片编辑、电商套图、人物写真、文章插图、PPT 生成和素材管理集中到一个浏览器界面中。

当前版本：`v0.2.1`

</div>

## 重要说明

- 本项目会调用你配置的官方 API、兼容 API 或第三方中转服务，产生的费用、限额和内容政策以实际服务提供方为准。
- 第三方网关对模型名称、接口后缀、流式响应和图像协议的实现可能不同，请先使用界面中的连接测试确认兼容性。
- API Key、生成图片和工作记录可能包含敏感信息。不要提交 `.env`、`.local/`、`output/`、`artifacts/` 或真实生成记录。
- 本地服务默认只监听 `127.0.0.1`。除非理解网络暴露风险，否则不要把服务开放到公网。
- 生成内容仍需人工检查事实准确性、品牌规范、肖像权、版权和目标平台规则。

## 项目概述

GPT-Image2-Studio 面向个人创作者、电商运营、设计师和内容团队。它不是单一的生图表单，而是一套围绕参考素材、创作计划、生成队列、失败重试、历史记录和本地输出目录组织的工作台。

项目提供三种主要运行形态：

| 运行方式 | 适合场景 | 数据特点 |
| --- | --- | --- |
| 本地 Node.js | 日常创作、完整本地工作流 | 配置、历史和输出默认保存在本机，功能最完整 |
| Windows 安装包 | 不想单独安装 Node.js 的 Windows 用户 | 内置 Node.js 运行时，安装后通过快捷方式启动 |
| Cloudflare Pages / Worker | 多设备访问或云端托管 | 依赖 R2，异步队列可使用 Queue；部分本地文件能力不可用 |

仓库还包含 `vercel.json`。Vercel 环境使用临时目录，不能当作本地持久化存储；部署前应在 Preview 环境验证长任务、SSE 和文件生命周期。

## 核心功能

### 图像创作

- **提示词生图**：最多上传 15 张参考图，支持提示词增强、比例、分辨率、PNG/JPG 输出和实时预览。
- **风格迁移**：组合原图与风格参考图，也可使用内置风格预设。
- **融图分析**：分析多张参考图的主体、风格和组合关系，再生成目标提示词。
- **图片拆解**：将产品、设备或包装图转成结构化说明图和卖点信息图。
- **图片编辑**：支持整图修改，也支持在画布上绘制多个局部蒙版并分别描述修改内容。
- **快速融图**：按 A/B/C/D 素材组和相同序号批量配对生成。
- **图片压缩**：在浏览器本地完成压缩、改尺寸和格式转换，不上传到服务端。

### 业务工作流

- **电商套图**：按平台、类目、商品事实、受众和 SKU 规划 4 到 18 张营销图，支持 Logo、补图队列和 Listing 草稿。
- **写真模式**：组合人物、动作、服装、道具和地点，生成 1 到 100 张系列写真。
- **文章插图**：解析文章包，建立风格、角色和场景设定，再生成正式插图计划。
- **PPT 生成**：从主题或文档生成 1 到 20 页演示文稿，支持单页编辑、补图、普通 PPTX 和可编辑重建导出。

### 资产与任务

- 瀑布画廊和图片详情灯箱，支持缩放、平移、下载和参数复盘。
- 套图、写真、文章插图和 PPT 独立记录页。
- 生成队列、后台任务状态、错误信息和失败项重试。
- Prompt Kit、图片转提示词、Logo 素材库和模型选择器。
- 深色/浅色主题、中英文界面和跨桌面/平板/手机布局。

## 快速开始

### 方式一：源码运行

前置条件：

- Node.js `20` 或更高版本
- 一个可用的 OpenAI API Key 或兼容服务凭据

```powershell
git clone https://github.com/aEboli/GPT-Image2-Studio.git
cd GPT-Image2-Studio
cmd /c npm ci
cmd /c npm start
```

浏览器打开：

```text
http://127.0.0.1:3600
```

端口被占用时：

```powershell
$env:PORT="3601"
cmd /c npm start
```

Windows 用户也可以双击 `launch-studio.cmd` 启动，使用 `stop-studio-services.cmd` 停止 `3600-3606` 端口上的本项目服务。

### 方式二：Windows 安装包

从 [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases) 下载：

```text
GPT-Image2-Studio-Setup-v0.2.1.exe
```

安装器默认写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装包内置 `runtime\node.exe`，无需另行安装 Node.js。安装完成后可通过桌面或开始菜单中的 `GPT-Image2-Studio.cmd` 启动。完整说明见 [Windows 安装包文档](./docs/windows-installer.md)。

## 配置说明

### 在界面中配置 API

首次启动后打开顶部的“配置”，按服务提供方填写：

| 配置项 | 说明 |
| --- | --- |
| Base URL | 例如 `https://api.openai.com/v1`，也可填写兼容服务地址 |
| API Key | 对应服务的访问密钥 |
| 接口后缀 | 常见值为 `responses`、`images/generations`、`images/edits` 或 `chat/completions` |
| 模型 | 按当前通道选择 Responses 模型、直接图片模型或兼容协议模型 |
| 调用通道 | 路由模式、直接调用模式或兼容协议模式 |

如果供应商提供完整 URL，例如：

```text
https://vendor.example/openai/v1/images/generations
```

Studio 会尝试拆分为：

```text
Base URL: https://vendor.example/openai/v1
接口后缀: images/generations
```

本地 Node 服务的配置默认保存到 `.local/config.json`。云端运行时，私有 API 配置由浏览器侧保存；不要在公共设备上保留密钥。

### 使用环境变量

`.env.example` 是环境变量清单和参考模板。当前 Node.js 入口直接读取 `process.env`，不会自动加载本地 `.env` 文件；请在 PowerShell、系统环境变量或部署平台中显式注入。仓库中的示例值为：

```dotenv
OPENAI_API_KEY=<your-api-key>
OPENAI_BASE_URL=https://api.openai.com/v1
RESPONSES_MODEL=gpt-5.4

HOST=
IMAGE_STUDIO_REQUEST_TOKEN=

IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0
IMAGE_STUDIO_DNS_FALLBACK_SERVERS=
```

| 变量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | 默认 API Key |
| `OPENAI_BASE_URL` | 默认 API Base URL |
| `RESPONSES_MODEL` | 默认 Responses 模型；应以实际服务支持的模型为准 |
| `PORT` | 本地服务端口，默认 `3600` |
| `HOST` | 监听地址；留空时为 `127.0.0.1` |
| `IMAGE_STUDIO_OUTPUT_DIR` | 自定义生成文件根目录 |
| `IMAGE_STUDIO_LOCAL_DATA_DIR` | 自定义本地配置和记录根目录 |
| `IMAGE_STUDIO_REQUEST_TOKEN` | 固定远程命令行写请求使用的令牌 |
| `IMAGE_STUDIO_DISABLE_DNS_FALLBACK` | 设为 `1` 时禁用 Node DNS fallback |
| `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` | 自定义 fallback DNS，支持逗号、分号或空白分隔 |

真实 `.env` 已被 `.gitignore` 排除，但仅创建该文件不会让本地服务自动读取它。云端部署请使用平台 Secret 或环境变量，不要把密钥写入仓库。

### 局域网访问与请求令牌

本地服务默认仅监听回环地址。需要局域网访问时可显式设置：

```powershell
$env:HOST="0.0.0.0"
$env:IMAGE_STUDIO_REQUEST_TOKEN="<strong-random-token>"
cmd /c npm start
```

同源浏览器请求可以正常使用。非回环、无 `Origin` 的命令行写请求需要携带：

```text
X-Image-Studio-Token: <strong-random-token>
```

如果没有设置 `IMAGE_STUDIO_REQUEST_TOKEN`，服务会在每次启动时随机生成令牌并打印到终端。

### Node DNS fallback

Node 服务优先使用系统默认的 `dns.lookup`。只有系统解析上游域名失败时，才会尝试备用解析器；内置候选包括 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器。

```powershell
# 禁用 fallback
$env:IMAGE_STUDIO_DISABLE_DNS_FALLBACK="1"

# 自定义备用 DNS
$env:IMAGE_STUDIO_DNS_FALLBACK_SERVERS="1.1.1.1,8.8.8.8"
```

## 部署方式

### Cloudflare Pages / Worker

构建静态资源和 Pages Worker：

```powershell
cmd /c npm ci
cmd /c npm run build:pages
```

构建产物写入 `dist/`。部署前需要检查并配置：

- `wrangler.jsonc`：Pages 输出目录和 `IMAGE_BUCKET` R2 绑定。
- `wrangler.api.jsonc`：独立 API Worker、`IMAGE_BUCKET`、`GENERATION_QUEUE` 和路由；其中的示例路由必须替换为你自己的域名或删除。
- Cloudflare Secret：API Key、Base URL 和模型配置，也可以由浏览器按用户保存私有配置。
- `cloudflare-r2-lifecycle.json`：按你的数据保留策略配置 R2 生命周期。

Cloudflare 与本地能力有差异：云端不能打开本机目录、返回本机绝对路径，也不能依赖本地文件完成套图/写真修复；服务端历史列表可能为空，浏览器缓存是云端记录的重要来源。

### Vercel

仓库中的 `vercel.json` 为 `server.mjs` 配置了依赖包含范围和 `300` 秒函数时长。可通过 Vercel 导入仓库或 CLI 创建 Preview 部署：

```powershell
vercel deploy
```

确认预览环境中的静态资源、API、SSE 和长任务后再发布：

```powershell
vercel deploy --prod
```

Vercel 运行时的输出和本地数据目录位于临时文件系统，实例回收后可能丢失。需要长期保存图片和历史时，优先使用本地运行，或为云端接入持久化存储。

### 构建 Windows 安装包

在 Windows 上运行：

```powershell
cmd /c npm ci
cmd /c npm run build:installer
```

产物路径格式：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.2.1.exe
```

脚本使用系统 `iexpress.exe` 生成自解压安装包，并把当前 Node.js 运行时和依赖打入安装目录。

## 输出与本地数据

本地服务默认将图片保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

不同工作流会创建独立目录，例如：

```text
YYYY-MM-DD-prompt\
YYYY-MM-DD-style-transfer\
YYYY-MM-DD-reference-analysis\
YYYY-MM-DD-image-edit\
YYYY-MM-DD-creation\
YYYY-MM-DD-portrait\
YYYY-MM-DD-article\
YYYY-MM-DD-ppt\
```

记录索引默认位于 `%USERPROFILE%\Pictures\json\`，服务端配置默认位于 `.local/config.json`。可以使用 `IMAGE_STUDIO_OUTPUT_DIR` 和 `IMAGE_STUDIO_LOCAL_DATA_DIR` 改写这两个根目录。

## 当前限制

| 项目 | 限制 |
| --- | --- |
| 普通参考图 / 融图分析 | 最多 15 张 |
| 图片编辑源图 | 1 张 |
| 图片编辑局部蒙版 | 每个源图最大 50 MB，源图与 mask 会规范化为同尺寸 PNG |
| 快速融图 | A/B 必选，C/D 可选，按相同序号配对 |
| 电商套图参考图 | 最多 15 张 |
| 电商套图数量 | 可选 4、6、7、8、9、10、12、14、16 或 18 张；也可按平台角色规划 |
| 写真人物 / 动作参考图 | 各最多 3 张 |
| 写真服装、道具和配饰参考图 | 最多 9 张 |
| 写真数量 | 1 到 100 张 |
| PPT 页数 | 1 到 20 页 |
| 输出格式 | PNG / JPG |

高分辨率和大批量任务更容易触发上游超时、限流或无最终图片结果。建议先用自动适配或中等尺寸确认画面方向，再提高分辨率或批量数量。

## 项目结构

```text
GPT-Image2-Studio/
|-- docs/                         # 安装、设计和开发文档
|-- examples/                     # API 请求与 SSE 示例
|-- lib/                          # 服务端与前端共享逻辑
|-- openspec/                     # 变更规格、设计和验收场景
|-- public/                       # 浏览器界面、样式、模块与内置资产
|-- scripts/                      # 同步、云端构建与安装包脚本
|-- test/                         # Node.js 测试
|-- cloudflare-pages-worker.mjs   # Cloudflare Pages / Worker API
|-- cloudflare-r2-lifecycle.json  # R2 生命周期示例
|-- generate-image.mjs            # 命令行单图生成入口
|-- server.mjs                    # 本地 Node.js 服务入口
|-- launch-studio.cmd             # Windows 快速启动器
|-- launch-studio.ps1             # Windows PowerShell 启动器
|-- stop-studio-services.cmd      # Windows 停止脚本
|-- vercel.json                   # Vercel 函数配置
|-- wrangler.jsonc                # Cloudflare Pages 配置
|-- wrangler.api.jsonc            # Cloudflare API Worker 配置
|-- package-lock.json
`-- package.json
```

## 开发与验证

常用命令：

```powershell
# 启动开发服务
cmd /c npm run dev

# 查看命令行生图帮助
cmd /c npm run help

# 同步共享模块到 public/lib
cmd /c npm run sync:public-lib

# 运行测试
cmd /c npm test

# 构建 Cloudflare Pages
cmd /c npm run build:pages
```

发布前建议执行：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run build:pages
git diff --check
```

Windows 安装包发布还应运行：

```powershell
cmd /c npm run build:installer
```

## 版本发布

- 版本号以 `package.json` 和 `package-lock.json` 为准。
- Git tag 使用 `v<version>`，例如 `v0.2.1`。
- Release 标题建议使用 `GPT-Image2-Studio v<version>`。
- Release 应至少附带变更说明、验证结果和对应的 Windows 安装包（如本次发布包含安装包）。
