# GPT-Image2-Studio

> 说明：本项目可通过中转服务把 `GPT-5.5`、`GPT-5.4`、`GPT-5.4-MINI` 等外层模型路由到 `image2` / `gpt-image-2` 图像能力。不同中转的路由识别能力和计费策略可能不同；如果上游没有识别到目标路由，费用可能按实际命中的模型计算。

<div align="center">

**本地优先的 AI 视觉创作工作台**

提示词生图、参考图分析、局部修图、电商套图、人物写真、文章插图、PPT 生成和素材画廊，全部收束在一个浏览器 Studio 中。

[![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
![ES Modules](https://img.shields.io/badge/ES%20Modules-native-222222)
![Local First](https://img.shields.io/badge/Local%20First-config%20and%20outputs-0f766e)
![GPT Image 2](https://img.shields.io/badge/Image%20Model-gpt--image--2-111827)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-compatible-f38020?logo=cloudflare&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-compatible-000000?logo=vercel&logoColor=white)

</div>

<p align="center">
  <img src="./prompt-template-popover.png" alt="GPT-Image2-Studio Prompt Kit 界面截图" width="920" />
</p>

## 项目定位

GPT-Image2-Studio 是一个面向创作者、电商运营、内容团队和产品设计流程的本地 Web 应用。它用本地 Node 服务、Cloudflare Pages Worker 或 Vercel 部署连接兼容的图像生成接口，把提示词、参考图、生成队列、历史记录、输出文件和工作流配置放在同一个 Studio 里。

它的设计目标是：

- 本地优先：API Key、私有 Base URL、生成记录和输出文件默认留在本机。
- 多通道兼容：支持 Responses 路由模式、直接调用模式和 Gemini 图像模型通道。
- 面向工作流：不只生成单图，也覆盖套图、写真、文章、PPT 和资产复用。
- 可部署：同一套前端和共享逻辑可运行在本地、Cloudflare Pages Worker 和 Vercel。
- 可验证：项目包含 Node test、public/lib 同步检查、Cloudflare Pages 构建和 Windows 安装包构建脚本。

## 近期更新

- 配置面板拆分为 `路由模式`、`直接调用模式` 和 `Gemini模型` 三类通道；每次生成都会提交当前通道快照，避免排队任务使用过期配置。
- 接口地址支持基础 URL 与完整 URL 粘贴。已知后缀会自动拆成 Base URL 和接口后缀，未知供应商路径会原样保留。
- 直接调用模式支持 `images/generations`、`responses`、`chat/completions`；图片编辑自动使用 `images/edits`。
- Gemini 模型通道支持独立 Base URL、API Key、图像模型、模型列表拉取和 `auto` / `512` / `1K` / `2K` / `4K` 尺寸。
- 普通通道覆盖 15 种常用比例，并按 1K、1.5K、2K、最大等档位生成像素尺寸。
- 本地生成支持后台提交和任务轮询，长任务不会长期占住浏览器连接。
- 胶片栏、预览区和套图卡片加入稳定 loading、排队中、失败和空状态，减少缩略图加载时的布局跳动。
- 本地 Node 服务加入 DNS fallback。系统解析上游域名失败时，会继续尝试 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器。
- Windows 安装包文档同步更新到 `v0.1.6`，包含当前配置面板、DNS fallback、构建和发布校验说明。

## 目录

- [快速开始](#快速开始)
- [功能总览](#功能总览)
- [核心工作流](#核心工作流)
- [API 与模型配置](#api-与模型配置)
- [命令行生成](#命令行生成)
- [输出目录](#输出目录)
- [参数与限制](#参数与限制)
- [本地与云端能力边界](#本地与云端能力边界)
- [部署与构建](#部署与构建)
- [验证命令](#验证命令)
- [常见问题](#常见问题)
- [项目结构](#项目结构)

## 快速开始

### Windows 安装包

从 GitHub Release 下载当前安装包：

```text
GPT-Image2-Studio-Setup-v0.1.6.exe
```

安装后从桌面或开始菜单启动：

```text
GPT-Image2-Studio.cmd
```

安装包内置 `runtime\node.exe`，不要求用户额外安装 Node.js。默认安装目录：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

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

Windows 下也可以双击项目根目录的启动器：

```text
launch-studio.cmd
```

停止本地服务：

```text
stop-studio-services.cmd
```

### 环境变量示例

仓库提供 `.env.example` 作为模板：

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
RESPONSES_MODEL=gpt-5.4

IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0
IMAGE_STUDIO_DNS_FALLBACK_SERVERS=
```

真实 `.env`、`.env.*` 和 `.local/` 默认被 `.gitignore` 排除，不要提交真实 API Key。

### 完整环境变量

| 变量 | 适用范围 | 说明 |
| --- | --- | --- |
| `OPENAI_API_KEY` | CLI、本地 Node、云端 | 路由模式默认 API Key，也可作为兼容端点密钥 |
| `OPENAI_BASE_URL` | CLI、本地 Node、云端 | 路由模式默认 Base URL，默认 `https://api.openai.com/v1` |
| `RESPONSES_MODEL` | CLI、本地 Node、云端 | 路由模式外层 Responses 模型 |
| `ENDPOINT_PATH` | 云端 | 路由模式接口后缀，常用 `responses` |
| `IMAGE_ROUTE` / `IMAGE_STUDIO_IMAGE_ROUTE` | 云端 | 默认调用通道，匹配路由模式、直接调用模式或 Gemini 模型通道 |
| `IMAGE_STUDIO_BASE_URL` | 云端 | `OPENAI_BASE_URL` 的部署侧别名 |
| `IMAGE_STUDIO_API_KEY` | 云端 | `OPENAI_API_KEY` 的部署侧别名 |
| `IMAGE_STUDIO_RESPONSES_MODEL` | 云端 | `RESPONSES_MODEL` 的部署侧别名 |
| `IMAGE_STUDIO_ENDPOINT_PATH` | 云端 | `ENDPOINT_PATH` 的部署侧别名 |
| `DIRECT_BASE_URL` / `IMAGE_STUDIO_DIRECT_BASE_URL` | 云端 | 直接调用模式 Base URL |
| `DIRECT_ENDPOINT_PATH` / `IMAGE_STUDIO_DIRECT_ENDPOINT_PATH` | 云端 | 直接调用模式接口后缀，常用 `images/generations`、`responses` 或 `chat/completions` |
| `DIRECT_API_KEY` / `IMAGE_STUDIO_DIRECT_API_KEY` | 云端 | 直接调用模式 API Key |
| `DIRECT_IMAGE_MODEL` / `IMAGE_STUDIO_DIRECT_IMAGE_MODEL` | 云端 | 直接调用模式图像模型 |
| `DIRECT_RESPONSES_MODEL` / `IMAGE_STUDIO_DIRECT_RESPONSES_MODEL` | 云端 | 直接调用模式里的视觉文本模型 |
| `PROTOCOL_BASE_URL` / `IMAGE_STUDIO_PROTOCOL_BASE_URL` | 云端 | Gemini 模型通道 Base URL |
| `PROTOCOL_API_KEY` / `IMAGE_STUDIO_PROTOCOL_API_KEY` | 云端 | Gemini 模型通道 API Key |
| `PROTOCOL_IMAGE_MODEL` / `IMAGE_STUDIO_PROTOCOL_IMAGE_MODEL` | 云端 | Gemini 模型通道图像模型 |
| `REASONING_EFFORT` / `IMAGE_STUDIO_REASONING_EFFORT` | 云端 | 默认推理强度，可选 `low`、`medium`、`high`、`xhigh` |
| `PORT` | 本地 Node、安装包 | 本地服务端口，默认 `3600` |
| `IMAGE_STUDIO_OUTPUT_DIR` | 本地 Node、测试 | 覆盖生成结果输出目录 |
| `IMAGE_STUDIO_LOCAL_DATA_DIR` | 本地 Node、测试 | 覆盖本地配置、索引和记录数据目录 |
| `IMAGE_STUDIO_DISABLE_DNS_FALLBACK` | 本地 Node、安装包 | 设置为 `1` 时禁用 DNS fallback |
| `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` | 本地 Node、安装包 | 自定义 DNS fallback 服务器，支持逗号、分号或空白分隔 |
| `IMAGE_STUDIO_MOCK_IMAGE_GENERATION` | 测试、调试 | 设置为 `1` 时启用本地图像生成 mock |
| `IMAGE_STUDIO_MOCK_LISTING_AGENT` | 测试、调试 | 设置为 `1` 时启用 Listing Agent mock |
| `IMAGE_BUCKET` | Cloudflare Worker | R2 bucket 绑定，用于临时图片存储和 `/api/images/*` 代理 |
| `GENERATION_QUEUE` | Cloudflare Worker | Queue 绑定，用于异步生成任务 |

本地浏览器也会保存一份私有配置。服务端本地配置位于 `.local/config.json`，云端部署默认把私有配置留在浏览器或平台 secret 中。

## 功能总览

| 模块 | 路由 | 适合场景 | 亮点 |
| --- | --- | --- | --- |
| 提示词生图 | `/#studio` | 单张海报、产品图、概念图、日常创作 | Prompt Kit、最多 15 张参考图、比例/分辨率/格式控制、实时状态 |
| 风格迁移 | `/#style-transfer` | 保留主体内容并迁移视觉风格 | 源图和风格图分槽上传，自动构造保留内容的提示词 |
| 融图分析 | `/#reference-analysis` | 多参考图关系分析、组合构图 | 先分析参考图关系，再生成目标提示词 |
| 图片拆解 | `/#image-decomposition` | 产品结构图、设备拆解、包装说明 | 单张图生成结构化信息图，支持两侧说明卡片和目标语言 |
| 图片编辑 | `/#image-edit` | 整图编辑、局部修图、区域重绘 | 单源图编辑、多区域画布蒙版、每区独立指令、一次合并或逐区精修 |
| 快速溶图 | `/#quick-blend` | A/B 产品融合、多组素材配对 | A/B 必选，C/D 可选，按同序号配对生成并写入普通画廊 |
| 图片压缩 | `/#image-compress` | 本地批量压缩、格式转换、尺寸压缩 | 浏览器本地处理，支持质量模式、目标体积模式、尺寸调整和下载 |
| 套图模式 | `/#creation` | 首屏主视觉、核心卖点图、SKU 补图 | 4-16 张计划、1577 个四级类目模板、Logo 控制、自动补图、Listing Agent |
| 写真模式 | `/#portrait` | 人物写真、头像、形象照、动作组图 | 人物分析、服装道具资产、动作预览、1-100 张写真计划 |
| 文章插图 | `/#article-illustration` | 长文配图、分镜插图、系列内容图 | 文章包解析、风格圣经、人物/场景设定、参考图和正式插图计划 |
| PPT 生成 | `/#ppt` | 文档转演示、主题成稿、逐页配图 | 文档分析、逐页生图、补齐缺页、页面编辑、PPTX 导出 |
| 瀑布画廊 | `/#gallery` | 查找、复用、下载普通生成资产 | 日期分页、搜索、预览、元数据、调用模式记录 |
| 记录中心 | `/#creation-record` 等 | 管理套图、写真、文章、PPT 历史 | 继续失败项、复制提示词、导出清单、打开本地文件夹 |

## 核心工作流

### Studio 创作区

Studio 是默认入口，用于提示词生图、风格迁移、参考图编排和图片拆解。它适合从一个提示词开始，也适合上传多张参考图后先做关系分析，再进入正式生成。每次生成会记录比例、分辨率、输出格式、调用模式、模型和中转地址，方便复盘不同通道的输出。

### 图片编辑与局部蒙版

图片编辑模式支持上传一张源图后进行整体编辑。需要精修时，可以在画布上新增多个区域，用画笔涂抹需要修改的位置，并为每个区域填写独立指令。

局部编辑有两种策略：

- `一次合并（快）`：把所有区域合并为一个 alpha mask，只调用一次图片编辑接口。
- `逐区精修（准）`：按区域顺序多次编辑，把上一轮输出作为下一轮源图，最后保存最终结果。

导出给上游的源图和 mask 会规范化为同尺寸 PNG。透明像素代表可编辑区域，不透明像素保护原图其余部分。

### 电商套图与 Listing Agent

套图模式面向单个商品生成营销图。填写商品名、描述、卖点、类目、视觉语言和输出参数后，可以生成 4 到 16 张基础营销图，并在需要时继续补齐 SKU 图或失败项。

套图模式包含：

- 1577 个四级电商类目模板。
- 参考图用途识别和风格参考图分离。
- Logo 单独上传、Logo 素材库和批量加 Logo。
- 单图提示词微调、历史套图复用、未生成图像补齐。
- Amazon US 英文 Listing Agent，支持父 Listing 草稿、变体数量证据、五点描述、搜索词和复核提示。

### 写真、文章与 PPT

写真模式会把人物参考、动作参考、服装道具配饰和地点提示拆成可复用计划，适合头像、形象照、旅行写真和系列组图。文章插图模式会先解析文章包，再生成风格圣经、人物/场景设定和插图计划。PPT 模式可把文档分析为页面大纲，逐页生成图片，导出普通 PPTX；本地环境具备 artifact-tool runtime 时，还可尝试可编辑重建。

### 批量与记录

快速溶图按 `A1+B1`、`A2+B2` 的顺序逐对生成。普通生成、风格迁移、参考图分析、图片拆解、图片编辑和快速溶图会进入瀑布画廊；套图、写真、文章插图和 PPT 有独立记录页，便于继续失败项、复制提示词、导出历史和复用旧任务。

## API 与模型配置

右下角配置面板会保存常用 API 参数，并按当前调用通道发送请求。

| 通道 | 典型用途 | 主要配置 |
| --- | --- | --- |
| 路由模式 | 通过 `Responses API + image_generation` 调用图片工具 | Base URL、API Key、`responses` 后缀、Responses 模型 |
| 直接调用模式 | 连接兼容生图端点，直接调用图片模型或兼容协议 | Base URL、API Key、`images/generations` / `responses` / `chat/completions` 后缀、图片模型、视觉文本模型 |
| Gemini模型 | 连接兼容 Gemini 图像生成协议的端点 | 基础 URL、API Key、图像模型、模型列表 |

常用默认值：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| 路由模式 Base URL | `https://api.openai.com/v1` | 可替换为兼容 Responses API 的私有端点 |
| 路由模式接口后缀 | `responses` | 用于 `Responses API + image_generation` |
| 路由模式 Responses 模型 | 本地默认 `gpt-5.4`，Cloudflare 默认 `gpt-5.5` | 负责文本规划、结构化输出和调用图片工具 |
| 直接调用模式 Base URL | `https://api.openai.com/v1` | 可替换为兼容生图接口的私有端点 |
| 直接调用模式接口后缀 | `images/generations` | 也可选 `responses` 或 `chat/completions` |
| 直接调用模式生图模型 | `gpt-image-2` | 可通过模型列表选择或手动填写 |
| 直接调用模式视觉文本模型 | `gpt-5.5` | 用于参考图分析、规划和文本视觉任务 |
| Gemini模型基础 URL | `https://api.openai.com/v1` | UI 示例为兼容中转的 `/v1` 基础地址，实际请求会走 `/images/generations` |
| Gemini模型图像模型 | `gemini-3.1-flash-image-preview` | 模型名包含 Gemini 图像特征时走 Gemini 图像生成请求体 |
| 推理强度 | `xhigh` | 可选 `low` / `medium` / `high` / `xhigh` |

### 接口地址与后缀

Studio 会把请求地址拆成 `Base URL + 接口后缀`。常用完整地址形态包括：

```text
https://api.openai.com/v1/responses
https://api.openai.com/v1/chat/completions
https://api.openai.com/v1/images/generations
https://api.openai.com/v1/images/edits
```

| 后缀 | 什么时候用 |
| --- | --- |
| `responses` | 路由模式默认值，也可用于直接调用模式连接兼容 Responses API 的中转或供应商 |
| `chat/completions` | 供应商只提供 Chat Completions 风格的视觉/生图协议时使用 |
| `images/generations` | 直接调用模式默认值，适合标准图片生成端点 |
| `images/edits` | 图片编辑专用端点，普通生图不需要手动选择 |

如果供应商给的是完整 URL，可以直接粘贴到接口地址输入框。保存时 Studio 会识别末尾的 `responses`、`chat/completions`、`images/generations` 或 `images/edits`，把前半段规范化保存为 Base URL，把末尾保存为对应通道的接口后缀，并丢弃 URL 里的查询参数和 hash。例如：

```text
https://vendor.example/openai/v1/chat/completions?token=debug
```

会保存为：

```text
Base URL: https://vendor.example/openai/v1
接口后缀: chat/completions
```

如果末尾不是已知后缀，Studio 会把整段当作 Base URL，保留供应商给出的路径。

### Node DNS fallback

本地 Node 服务启动时会保留系统默认 `dns.lookup` 路径。只有当系统解析上游域名失败时，才会按顺序使用 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器再尝试一次。Cloudflare Pages Worker 和 Vercel 部署不使用这段本地 Node DNS fallback。

禁用 fallback：

```powershell
$env:IMAGE_STUDIO_DISABLE_DNS_FALLBACK="1"
cmd /c npm start
```

自定义服务器列表：

```powershell
$env:IMAGE_STUDIO_DNS_FALLBACK_SERVERS="8.8.8.8,1.1.1.1"
cmd /c npm start
```

如果 DNS 配置失败，启动日志会输出 `DNS fallback 配置失败：...`，服务会继续启动。

## 命令行生成

```powershell
$env:OPENAI_API_KEY="你的 API Key"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:RESPONSES_MODEL="gpt-5.4"

cmd /c npm run generate -- --prompt "一张产品海报，明亮商业摄影，干净背景" --size "1024x1536" --quality "high" --format "jpeg"
```

查看命令行帮助：

```powershell
cmd /c npm run help
```

## 输出目录

本地服务默认把生成结果保存到 Windows 图片目录：

```text
C:\Users\<你的用户名>\Pictures\YYYY-MM\MM-DD\
```

不同模式会写入独立子目录：

```text
YYYY-MM-DD-prompt\
YYYY-MM-DD-style-transfer\
YYYY-MM-DD-reference-analysis\
YYYY-MM-DD-image-decomposition\
YYYY-MM-DD-image-edit\
YYYY-MM-DD-quick-blend\
YYYY-MM-DD-creation\HHMM-商品名-短ID\
YYYY-MM-DD-portrait\HHMM-人物名-短ID\
YYYY-MM-DD-article\文章名-短ID\
YYYY-MM-DD-ppt\PPT名称-短ID\
```

记录清单默认写入：

```text
Pictures\json\creation-sets\
Pictures\json\portrait-sets\
Pictures\json\article-illustration-sets\
Pictures\json\ppt-decks\
```

命令行生成默认写入项目内：

```text
output/generated-时间戳.<ext>
```

## 参数与限制

| 项目 | 当前限制 |
| --- | --- |
| 普通参考图 | 最多 15 张 |
| 融图分析参考图 | 最多 15 张 |
| 批量 Logo 源图 | 最多 15 张 |
| 图片编辑源图 | 1 张 |
| 图片编辑局部蒙版 | 每个源图最大 50 MB；源图和 mask 会规范化为同尺寸 PNG |
| 套图参考图 | 最多 15 张 |
| 套图风格参考图 | 最多 3 张，且与套图参考图合计最多 15 张 |
| 写真人物参考图 | 最多 3 张 |
| 写真动作参考图 | 最多 3 张 |
| 写真服装/道具/配饰参考图 | 最多 9 张 |
| 写真计划数量 | 1-100 张 |
| 套图基础数量 | 4 / 6 / 8 / 10 / 12 / 14 / 16 张，SKU 补图可追加 |
| PPT 页数 | 1-20 页 |
| 排队任务数 | 不设硬上限；本地队列按模式与通道并发上限逐批处理 |
| 并发生成数 | 每个模式与调用通道分组默认最多 15 个 |
| 输出格式 | PNG / JPG |

常用比例和尺寸：

| 比例 | 适合场景 | `auto` 默认尺寸 | 可选尺寸 |
| --- | --- | --- | --- |
| `1:1` | 电商主图、头像、社交媒体 | `1024x1024` | `1024x1024`、`1536x1536`、`2048x2048`、`2560x2560`、`2880x2880` |
| `4:3` | PPT、网页配图 | `1360x1024` | `1360x1024`、`2048x1536`、`2720x2048`、`3312x2480` |
| `3:4` | 海报、人像 | `1024x1360` | `1024x1360`、`1536x2048`、`2048x2720`、`2480x3312` |
| `3:2` | 摄影风格横图 | `1536x1024` | `1536x1024`、`2304x1536`、`3072x2048`、`3520x2352` |
| `2:3` | 竖版摄影 | `1024x1536` | `1024x1536`、`1536x2304`、`2048x3072`、`2352x3520` |
| `5:4` | 商品展示横图 | `1280x1024` | `1280x1024`、`1920x1536`、`2560x2048`、`3200x2560` |
| `4:5` | Instagram 帖子、竖版商品图 | `1024x1280` | `1024x1280`、`1536x1920`、`2048x2560`、`2560x3200` |
| `16:9` | 横版封面、YouTube | `1824x1024` | `1824x1024`、`2736x1536`、`3648x2048`、`3840x2160` |
| `9:16` | 短视频封面、手机壁纸 | `1024x1824` | `1024x1824`、`1536x2736`、`2048x3648`、`2160x3840` |
| `21:9` | 超宽横幅 | `2384x1024` | `2384x1024`、`1680x720`、`3584x1536`、`3840x1648` |
| `9:21` | 超长竖图 | `1024x2384` | `1024x2384`、`720x1680`、`1536x3584`、`1648x3840` |
| `2:1` | Banner 横幅 | `2048x1024` | `2048x1024`、`3072x1536`、`3840x1920` |
| `1:2` | 长海报 | `1024x2048` | `1024x2048`、`1536x3072`、`1920x3840` |
| `3:1` | 超宽广告图 | `3072x1024` | `3072x1024`、`3840x1280` |
| `1:3` | 超长竖版广告 | `1024x3072` | `1024x3072`、`1280x3840` |

Gemini 模型通道使用协议尺寸：

| 模式 | 默认值 | 可选值 |
| --- | --- | --- |
| Gemini模型 | `1K` | `auto`、`512`、`1K`、`2K`、`4K` |

Gemini 模型通道里，`auto` 最终会按 `1K` 发送。高分辨率更容易触发上游超时、失败或没有最终图片结果。日常建议优先使用 1K 到 2K 尺寸，需要大图时再逐档尝试。

## 本地与云端能力边界

| 能力 | 本地 Node | Cloudflare Pages Worker / Vercel |
| --- | --- | --- |
| 普通图片生成 | 支持路由模式、直接调用模式和 Gemini 模型 | 支持核心生成，按部署配置保存调用通道 |
| 风格迁移、融图分析、图片拆解 | 支持 | 支持核心生成 |
| 图片编辑 | 支持整图编辑、局部蒙版、逐区精修、记录和路径回报 | 支持整图编辑和局部蒙版；本地文件夹操作不可用 |
| 图片压缩 | 浏览器本地处理 | 浏览器本地处理 |
| 套图生成 | 支持记录、补图、打开文件夹和路径回报 | 支持生成；本地文件夹操作不可用 |
| 写真生成 | 支持记录、补图、打开文件夹和路径回报 | 支持生成；本地文件夹操作不可用 |
| 文章插图 | 支持计划、参考图、正式插图和记录 | 以部署配置为准 |
| PPT 普通导出 | 支持 | 支持 |
| PPT 可编辑重建 | 需要本地 Presentations artifact-tool runtime | 不加载 artifact-tool，只保留普通 PPTX 并返回不支持提示 |
| 调用模式与元数据 | 本地索引、sidecar 和浏览器缓存保留 `imageRoute` | 生成、模型列表和服务端图片链接按部署配置保留调用模式信息 |
| API Key 存储 | `.local/config.json` 或浏览器本地配置 | 浏览器本地配置或部署侧安全注入 |

## 部署与构建

### 架构入口

| 文件 | 角色 |
| --- | --- |
| `server.mjs` | 本地 Node Web 服务入口，负责 API、输出文件、记录索引和本地文件夹能力 |
| `cloudflare-pages-worker.mjs` | Cloudflare Worker API 入口，负责云端生成、R2 临时图片代理和 Queue 消费 |
| `public/index.html` / `public/app.js` | 浏览器 Studio 壳层、视图切换、状态管理和交互入口 |
| `lib/` | 本地服务和前端共享逻辑源文件 |
| `public/lib/` | 浏览器可直接加载的共享模块副本，由 `scripts/sync-public-lib.mjs` 同步 |
| `generate-image.mjs` | 命令行单图生成入口 |
| `scripts/build-cloudflare-pages.mjs` | Cloudflare Pages 静态产物构建脚本 |
| `scripts/build-windows-installer.mjs` | Windows 自解压安装包构建脚本 |

修改 `lib/` 下会被浏览器加载的模块后，需要运行：

```powershell
cmd /c npm run sync:public-lib -- --check
```

检查失败时运行：

```powershell
cmd /c npm run sync:public-lib
```

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

Cloudflare API Worker 使用 `wrangler.api.jsonc`。当前配置包含：

```text
R2 binding: IMAGE_BUCKET -> gpt-image2-studio-images
Queue binding: GENERATION_QUEUE -> gpt-image2-studio-generation
Route: studio.827899031.xyz/api/*
```

典型部署步骤：

```powershell
cmd /c npm run build:pages
wrangler pages deploy dist --project-name gpt-image2-studio
wrangler r2 bucket create gpt-image2-studio-images
wrangler queues create gpt-image2-studio-generation
wrangler deploy --config wrangler.api.jsonc
```

实际部署前请先在 Cloudflare 控制台或 `wrangler secret put` 中配置 API Key、Base URL 和模型相关变量。`cloudflare-r2-lifecycle.json` 可用于给 R2 临时对象设置生命周期规则，建议让 `images/`、`generation-tasks/`、`generation-requests/` 等临时数据自动过期。

### Vercel

仓库包含 `vercel.json`，本地和云端共享核心生成逻辑。导入仓库后可直接按 Vercel 项目流程部署，或使用命令行发布：

```powershell
vercel deploy --prod
```

云端环境需要在 Vercel 项目设置中安全注入 API Key、Base URL 和模型相关环境变量。

### Windows 安装包

```powershell
cmd /c npm run build:installer
```

安装包产物写入：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.6.exe
```

更多说明见 [docs/windows-installer.md](./docs/windows-installer.md)。

## 验证命令

提交或发布前建议运行：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run build:pages
git diff --check
```

需要同时验证 Windows 安装包时再运行：

```powershell
cmd /c npm run build:installer
```

提交前确认以下路径没有进入暂存区：

```text
.local/
.env
.env.*
output/
artifacts/
dist/
node_modules/
.vercel/
.playwright-mcp/
.codex/
*.log
```

## 常见问题

| 现象 | 常见原因 | 处理方式 |
| --- | --- | --- |
| `npm start` 后中文日志显示乱码 | Windows 控制台没有按 UTF-8 显示输出 | 先打开 `http://localhost:3600` 验证服务；需要看中文日志时用 `cmd /c npm start` |
| 端口 `3600` 被占用 | 本机已有旧服务或其他程序占用端口 | 用 `$env:PORT="3601"; cmd /c npm start`，或双击 `launch-studio.cmd` |
| 页面能打开，但生成时报 API Key 或上游请求错误 | 当前调用通道没有保存 API Key，或 Base URL / 模型配置不正确 | 在右下角配置面板确认路由模式、直接调用模式或 Gemini 模型，并保存对应配置 |
| 直接调用模式的编辑端点不在下拉框里 | 图片编辑会自动走 `images/edits` | 普通生图保持 `images/generations`、`responses` 或 `chat/completions` 即可 |
| Gemini 模型通道没有返回图片 | 模型名、协议或供应商响应格式不匹配 | 确认基础 URL 会实际请求 `/images/generations`，并使用兼容图像生成的 Gemini 模型 |
| 拉取后提示找不到依赖模块 | 没安装依赖，或旧 `node_modules` 与 lockfile 不一致 | 在仓库根目录执行 `cmd /c npm ci` |
| 浏览器控制台提示 `/lib/*.mjs` 404 或公共模块不一致 | 开发时改了 `lib/` 但没有同步 `public/lib/` | 执行 `cmd /c npm run sync:public-lib -- --check`；失败时执行 `cmd /c npm run sync:public-lib` |
| 自写 Node 脚本里 `spawn npm` 出现 `spawn EINVAL` | Windows npm shim 在部分执行环境里不能被 Node 子进程直接调用 | 使用 `cmd /c npm ...`，或 spawn `cmd.exe /c npm ...` |

## 项目结构

```text
GPT-Image2-Studio/
|-- docs/                         # 教程、安装说明和执行计划记录
|-- examples/                     # API 请求与 SSE 示例
|-- lib/                          # 本地服务和前端共享逻辑
|-- openspec/                     # 规格变更、设计和验收场景
|-- public/                       # 浏览器工作台、样式、前端模块和内置资产
|   |-- assets/portrait-actions/  # 写真动作预览图
|   `-- assets/portrait-accessories/ # 写真服装道具配饰资产
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
|-- vercel.json                   # Vercel 兼容配置
|-- package-lock.json
`-- package.json
```
