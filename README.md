# GPT-Image2-Studio

> 说明：本软件可用于通过中转服务将 `GPT-5.5`、`GPT-5.4`、`GPT-5.4-MINI` 等模型路由成 `image2` 模型使用。理论上请求会按 `image2` 模型处理；但受当前中转路由识别技术限制，部分中转可能无法识别该路由，此时计费会按照实际使用的模型计费。

<div align="center">

本地优先的 AI 图片、商品套图、写真、文章插图与 PPT 创作工作台。

通过浏览器工作台管理提示词、参考图、批量计划、生成队列、历史记录和导出文件；本地 Node 服务或 Cloudflare Pages Worker 可通过 `Responses API` + `image_generation` 路由生图，也可切换到独立的直接调用模式调用生图端点。

[![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
![ES Modules](https://img.shields.io/badge/ES%20Modules-native-222222)
![Local First](https://img.shields.io/badge/local--first-config%20and%20outputs-0f766e)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-compatible-f38020?logo=cloudflare&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-compatible-000000?logo=vercel&logoColor=white)

</div>

<p align="center">
  <img src="./prompt-template-popover.png" alt="GPT-Image2-Studio Prompt Kit 界面截图" width="920" />
</p>

> 隐私默认值：路由模式与直接调用模式的 API Key、私人 Base URL 默认只保存在本机 `.local/config.json` 或浏览器本地配置中。生成结果默认写入 Windows 图片目录；`.local/`、`output/`、`artifacts/`、`dist/`、日志和构建产物不会提交到 GitHub。

## 目录

- [核心能力](#核心能力)
- [发行版说明](#发行版说明)
- [快速启动](#快速启动)
- [配置 API](#配置-api)
- [生成日志与元数据](#生成日志与元数据)
- [命令行生成](#命令行生成)
- [功能入口](#功能入口)
- [参数与限制](#参数与限制)
- [输出路径](#输出路径)
- [本地与云端能力边界](#本地与云端能力边界)
- [常见启动问题](#常见启动问题)
- [构建与验证](#构建与验证)
- [项目结构](#项目结构)

## 核心能力

| 能力 | 适合场景 | 关键特性 |
| --- | --- | --- |
| Studio 单图 | 提示词生图、参考图生图、风格迁移 | 最多 15 张参考图上传、比例/分辨率/格式选择、SSE 实时状态、瀑布画廊 |
| 图片拆解 | 产品、设备、服饰、包装结构分析 | 单张源图生成高信息密度拆解图，支持标注语言和两侧说明卡片 |
| 快速溶图 | A/B 图片批量配对融合 | A 组和 B 组按顺序配对，逐对生成溶图结果，并写入普通画廊 |
| 套图模式 | 电商商品营销图、SKU 补图、品牌图批量生产 | 计划预览、套图生成队列、单图提示词微调、未生成图像补齐、15 张参考图、Logo 控制、四级类目模板 |
| 写真模式 | 人物参考图生成专业摄影写真 | 1-100 张计划、人物可见特征分析、服装/道具/配饰资产库、动作预览 |
| 文章插图 | 长文配图、分镜插图、系列化视觉 | 先解析文章包，再生成分镜、风格圣经、人物/场景设定和正式插图计划 |
| PPT 生成 | 文档转演示、主题转演示、逐页配图 | 文档分析、逐页生图、补齐缺页、单页标注重绘、PPTX 导出 |
| 资产记录 | 生成结果复用、搜索、导出和文件管理 | 画廊、套图、写真、文章插图和 PPT 记录分开管理，并保留调用模式元数据 |
| 本地服务 | 本机创作工作台与文件系统集成 | 静态页面托管、配置保存、SSE 转发、图片写入、目录打开 |

## 发行版说明

### v0.1.4

- 发行版从 `0.1.2` 提升到 `0.1.4`，Windows 安装包文件名同步为 `GPT-Image2-Studio-Setup-v0.1.4.exe`。
- 连接配置升级为“调用通道”：路由模式走 `Responses API` + `image_generation`，直接调用模式使用独立 Base URL、API Key 和生图模型配置；顶部状态会显示当前生图调用模式。
- 生成日志改为更紧凑的状态视图，展示生成中、已生成、失败、调用模式、比例、分辨率和中转地址；画廊与浏览器缓存会记录 `imageRoute`，历史元数据修复时也会保留调用模式。
- 普通参考图、融图分析和批量 Logo 源图上限提升到 15 张；快速溶图配对预览支持按同一序号删除 A/B/C/D 整组，并增加生成中缩略状态。
- 配置抽屉、语言入口、套图记录详情和预览布局做了收敛，减少长文本和日志对主要工作区的挤占。

## 快速启动

### 本地开发

```powershell
npm install
npm start
```

从 GitHub 新拉取仓库时推荐用下面的完整流程，能避开 Windows npm shim 和 PowerShell 编码造成的误判：

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

如果 `3600` 端口已被占用：

```powershell
$env:PORT="3601"
npm start
```

Windows 下也可以双击项目根目录的启动器：

```text
launch-studio.cmd
```

停止本地服务：

```text
stop-studio-services.cmd
```

如果控制台出现中文乱码，但浏览器能打开 `http://localhost:3600`，那通常只是 Windows 控制台编码显示问题，不代表服务启动失败。

## 配置 API

浏览器右下角配置面板可保存常用 API 参数，并按当前“生图调用模式”发送请求：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| 生图调用模式 | 路由模式 | 路由模式通过 `Responses API` 调用 `image_generation`；直接调用模式使用独立生图端点和生图模型 |
| 路由模式接口地址 | `https://api.openai.com/v1` | 可替换为兼容 Responses API 的私有端点 |
| 路由模式 API Key | 空 | 本地保存，不提交到仓库 |
| 路由模式 Responses 模型 | 本地默认 `gpt-5.4`，Cloudflare 默认 `gpt-5.5` | 负责文本规划、结构化输出和调用图片工具 |
| 直接调用模式接口地址 | `https://api.openai.com/v1` | 可替换为兼容生图接口的私有端点 |
| 直接调用模式 API Key | 空 | 与路由模式分开保存，便于使用不同中转或额度 |
| 直接调用模式生图模型 | `gpt-image-2` | 可通过模型列表选择或手动填写 |
| 推理强度 | `xhigh` | 可选 `low` / `medium` / `high` / `xhigh` |

配置面板顶部会同步当前调用模式；生成日志、画廊参数和本地元数据会记录对应的调用模式与中转地址，方便之后排查计费、路由或模型差异。

直接调用模式只使用独立生图端点和生图模型；生成结果的参数面板会隐藏外层 Responses 模型、推理强度等路由模式字段。

## 生成日志与元数据

生成日志位于配置抽屉内，会把上游事件整理为“图片生成中”“图片已生成”“生成失败”等摘要，并显示调用模式、比例、分辨率、图片链接和中转地址。页面重新加载后，仍处于活动状态的历史生成记录会被标记为中断，避免误以为旧任务仍在继续。

本地画廊索引、JSON sidecar、浏览器缓存和历史元数据修复流程都会保留 `imageRoute`。使用 Cloudflare Pages Worker 时，服务端图片链接和 R2 metadata 也会带上调用模式相关信息，便于后续排查路由、模型和计费差异。

## 命令行生成

```powershell
$env:OPENAI_API_KEY="你的 API Key"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:RESPONSES_MODEL="gpt-5.4"

npm run generate -- --prompt "一张产品海报，明亮商业摄影，干净背景" --size "1024x1536" --quality "high" --format "jpeg"
```

查看命令行帮助：

```powershell
npm run help
```

## 功能入口

| 功能 | 路由 | 说明 |
| --- | --- | --- |
| Studio | `/#studio` | 默认单图生成、参考图生成和 Prompt Kit 模板 |
| 风格迁移 | `/#style-transfer` | 用原图保留内容，用风格参考图控制视觉风格 |
| 参考图编排 | `/#reference-analysis` | 分析多张参考图关系，再用于正式生成 |
| 图片拆解 | `/#image-decomposition` | 单张源图生成结构化拆解信息图 |
| 快速溶图 | `/#quick-blend` | 上传 A/B 必选组和 C/D 可选组，按顺序配对并选择排列与队形后生成溶图结果 |
| 套图模式 | `/#creation` | 单商品电商营销套图生成 |
| 套图记录 | `/#creation-record` | 搜索、导出、补齐未生成图像、重生成和复用历史套图 |
| 写真模式 | `/#portrait` | 人物参考图生成专业摄影写真 |
| 写真记录 | `/#portrait-record` | 搜索、预览、导出提示词和复用写真记录 |
| 文章插图 | `/#article-illustration` | 长文分析、分镜计划和正式插图生成 |
| 文章记录 | `/#article-record` | 复制题注、继续失败项和检索插图记录 |
| PPT 生成 | `/#ppt` | 文档、文本或主题生成演示文稿 |
| PPT 记录 | `/#ppt-record` | 查看 PPTX 下载入口和历史记录 |
| 画廊 | `/#gallery` | 普通生成、风格迁移、参考图编排和图片拆解结果 |

### 工作流补充

<details>
<summary>快速溶图</summary>

快速溶图入口在 `/#quick-blend`，也可从创建菜单进入。它面向多组产品图的批量溶图：上传 A 组和 B 组后，系统会严格按顺序配对为 `A1+B1`、`A2+B2`、`A3+B3`，每一对提交一个独立生成任务；C 组和 D 组为可选产品组，上传后会按同一序号加入对应任务。

A/B 两组图片数量必须一致；C/D 组可为空，若启用也必须与 A 组数量一致。每个任务会携带 2 到 4 张参考图，并保留 A/B/C/D 的产品组标签。生成前可以在各组列表中调整顺序，按同一序号删除整组配对，选择上下或左右排列，以及正方形或矩形队形，再点击“开始快速溶图”。结果会显示在快速溶图预览区，并作为普通画廊资产保存，便于后续下载、查看和复用。

</details>

<details>
<summary>套图模式</summary>

套图模式面向单个商品生成电商营销图。填写商品名、描述和卖点后，可选择 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 张基础营销图数量、营销场景、目标语言、视觉语言、比例、分辨率、输出格式、行业模板和 18 类图片角色组合，其中包含品牌故事图、图片拆解图。

它还支持 1577 个四级电商类目模板、参考图用途识别、Logo 单独上传、SKU 主体补图、上传图批量加 Logo、计划预览、单张提示词微调、补齐未生成图像和历史套图复用。套图记录页可直接筛选历史套图并触发“补齐未生成图像”，队列中的同一套图会同步更新状态，便于继续处理上游超时或缺图的批次。

套图模式还可以选择在生成完成后自动撰写 Amazon US 英文 Listing。Listing Agent 会生成一份父 Listing 草稿，把 SKU 主体作为变体和数量证据；当一个 SKU 主体包含 3 个完整可售主体时，标题不会回落成 `1 Pack`。标题会把数量放在最前面，但不写尺寸、重量、钩号或其他规格值，并继续补强核心搜索词、长尾词、流量词和描述词。若生成图失败或缺失，会降级为基于商品输入、SKU 元数据、尺寸和类目路径撰写，并在草稿中标记为 `input-only`。每个字段和每条 bullet 都限制在 500 字符以内，`sellingPoints` 与 `painPoints` 还会分别校验合计 500 个英文字符以内；警告和缺失信息会尽量映射为具体中文复核提示，避免只显示重复的通用说明。

</details>

<details>
<summary>写真模式</summary>

写真模式面向人物参考图生成一组专业摄影写真。人物参考图最多 3 张，服装/道具/配饰参考图最多 9 张。上传人物参考图后可点击“分析人物”得到可编辑的可见特征草稿，也可以直接手写人物描述。

内置摄影风格包括商务形象、时尚杂志、电影街拍、棚拍质感、自然光生活、复古胶片、黑白肖像、户外旅拍、社媒头像和自定义风格。动作选择器覆盖站立、行走、坐姿、倚靠、回眸、整理衣袖、手持道具和转身动感。

</details>

<details>
<summary>文章插图</summary>

文章插图模式支持粘贴正文、上传 `.txt` / `.md` / `.csv` / `.json` 文本文件和填写补充说明。系统会先完整阅读文章包，再生成分镜、风格圣经、人物/场景设定、重点参考图和正式插图计划。

用户可以先生成参考图，再确认生成正式插图；插图数量由模型根据文章节奏建议，不复用套图固定张数。

</details>

<details>
<summary>PPT 生成</summary>

PPT 工作流支持上传 PDF / DOCX / PPTX / TXT / MD / CSV，直接粘贴大段文本，或只输入主题让模型生成大纲。可先点击“分析文档”，让模型推荐页数、风格和内容分段；也可以直接设置页数、视觉风格、动态组件、转场、自动播放秒数和 PPTX 导出方式后生成。

默认导出路径是稳定的整页图片 PPTX；本地环境还可尝试用 Presentations artifact-tool 生成额外的可编辑 PPTX。

</details>

## 参数与限制

| 项目 | 当前限制 |
| --- | --- |
| 普通参考图 | 最多 15 张 |
| 融图分析参考图 | 最多 15 张 |
| 批量 Logo 源图 | 最多 15 张 |
| 套图参考图 | 最多 15 张 |
| 写真人物参考图 | 最多 3 张 |
| 写真服装/道具/配饰参考图 | 最多 9 张 |
| 写真计划数量 | 1-100 张 |
| 套图基础数量 | 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 张，SKU 补图可追加 |
| PPT 页数 | 1-20 页 |
| 排队任务数 | 不设硬上限；本地队列会按并发上限逐批处理 |
| 并发生成数 | 最多 15 个 |
| 推理强度 | `low` / `medium` / `high` / `xhigh` |
| 输出格式 | PNG / JPG |

比例与分辨率：

| 比例 | `auto` 默认尺寸 | 可选尺寸 |
| --- | --- | --- |
| `1:1` | `1024x1024` | `1024x1024`、`1536x1536`、`2048x2048`、`2816x2816` |
| `5:4` | `1280x1024` | `1280x1024`、`1920x1536`、`2560x2048`、`3120x2496` |
| `9:16` | `720x1280` | `720x1280`、`1152x2048`、`2016x3584`、`2151x3824`、`2160x3840` |
| `21:9` | `1680x720` | `1680x720`、`1916x821`、`2688x1152`、`3360x1440`、`3824x1639`、`3832x1642`、`3840x1646` |
| `16:9` | `1280x720` | `1280x720`、`2048x1152`、`3584x2016`、`3824x2151`、`3840x2160` |
| `4:3` | `1024x768` | `1024x768`、`1536x1152`、`2048x1536`、`3072x2304` |
| `3:2` | `1536x1024` | `1536x1024`、`2304x1536`、`3072x2048`、`3456x2304` |
| `4:5` | `1024x1280` | `1024x1280`、`1536x1920`、`2048x2560`、`2496x3120` |
| `3:4` | `768x1024` | `768x1024`、`1536x2048`、`1920x2560`、`2304x3072`、`2448x3264` |
| `2:3` | `1024x1536` | `1024x1536`、`1536x2304`、`2048x3072`、`2304x3456` |

高分辨率更容易触发上游超时、失败或没有最终图片结果。日常建议优先使用 1K 到 2K 尺寸，需要大图时再逐档尝试。

## 输出路径

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
YYYY-MM-DD-quick-blend\
YYYY-MM-DD-creation\HHMM-商品名-短ID\
YYYY-MM-DD-portrait\HHMM-人物名-短ID\
YYYY-MM-DD-article\文章名-短ID\
YYYY-MM-DD-ppt\PPT名称-短ID\
```

清单与索引：

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

`output/` 已被 `.gitignore` 忽略，不会提交到 GitHub。

## 本地与云端能力边界

| 能力 | 本地 Node | Cloudflare Pages Worker / Vercel |
| --- | --- | --- |
| 普通图片生成 | 支持 | 支持 |
| 风格迁移、参考图编排、图片拆解 | 支持 | 支持核心生成 |
| 套图生成 | 支持记录、补图、打开文件夹和路径回报 | 支持生成；本地文件夹操作不可用 |
| 写真生成 | 支持记录、补图、打开文件夹和路径回报 | 支持生成；本地文件夹操作不可用 |
| 文章插图 | 支持计划、参考图、正式插图和记录 | 以部署配置为准 |
| PPT 普通导出 | 支持 | 支持 |
| PPT 可编辑重建 | 需要本地 Presentations artifact-tool runtime | 不加载 artifact-tool，只保留普通 PPTX 并返回不支持提示 |
| 调用模式与元数据 | 本地索引、sidecar 和浏览器缓存保留 `imageRoute` | 生成、模型列表和服务端图片链接按部署配置保留调用模式信息 |
| API Key 存储 | `.local/config.json` | 浏览器本地配置或部署侧安全注入 |

## 常见启动问题

| 现象 | 常见原因 | 处理方式 |
| --- | --- | --- |
| `npm start` 后中文日志显示乱码 | Windows 控制台没有按 UTF-8 显示输出 | 先打开 `http://localhost:3600` 验证服务；需要看中文日志时用 `cmd /c npm start` 或浏览器页面结果判断 |
| 端口 `3600` 被占用 | 本机已有旧服务或其他程序占用端口 | 用 `$env:PORT="3601"; npm start`，或双击 `launch-studio.cmd` 让启动器自动找附近可用端口 |
| 页面能打开，但生成时报 API Key 或上游请求错误 | 当前调用模式没有保存 API Key，或 Base URL / 模型配置不正确 | 在右下角配置面板确认路由模式或直接调用模式，并保存对应 API Key、Base URL 和模型后再生成；命令行生成则先设置 `OPENAI_API_KEY` |
| 拉取后提示找不到依赖模块 | 没安装依赖，或旧 `node_modules` 与当前 lockfile 不一致 | 在仓库根目录执行 `cmd /c npm ci`；不要提交 `node_modules/` |
| 浏览器控制台提示 `/lib/*.mjs` 404 或公共模块不一致 | 开发时改了 `lib/` 但没有同步 `public/lib/` | 执行 `cmd /c npm run sync:public-lib -- --check`；如果检查失败，执行 `cmd /c npm run sync:public-lib` 后重新测试 |
| 自写 Node 脚本里 `spawn npm` 出现 `spawn EINVAL` | Windows npm shim 在部分执行环境里不能被 Node 子进程直接调用 | 直接用 `cmd /c npm start`、`cmd /c npm test`，或改为 spawn `cmd.exe /c npm ...` |

## 构建与验证

常用验证命令：

```powershell
cmd /c npm test
cmd /c npm run build:pages
cmd /c npm run sync:public-lib -- --check
git diff --check
```

Cloudflare Pages 构建：

```powershell
npm run build:pages
```

构建产物写入：

```text
dist/
```

Windows 安装包：

```powershell
npm run build:installer
```

安装包产物写入：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.4.exe
```

## GitHub 同步注意事项

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
*.log
```

没有用户明确要求时，不自动创建 tag 或 GitHub Release；发行版号需与 `package.json`、`package-lock.json` 和安装包说明同步。

## 项目结构

```text
GPT-Image2-Studio/
├── docs/                         # 教程、发布说明和执行计划记录
├── examples/                     # API 请求与 SSE 示例
├── lib/                          # 本地服务和前端共享逻辑
├── openspec/                     # 规格变更、设计和验收场景
├── public/                       # 浏览器工作台、样式、前端模块和内置资产
│   ├── assets/portrait-actions/  # 写真动作预览图
│   └── assets/portrait-accessories/ # 写真服装道具配饰资产
├── scripts/                      # 构建、打包和 public/lib 同步脚本
├── test/                         # Node test 测试
├── cloudflare-pages-worker.mjs   # Cloudflare Pages API Worker
├── generate-image.mjs            # 命令行单图生成入口
├── server.mjs                    # 本地 Web 服务入口
├── launch-studio.cmd             # Windows 快速启动器
├── launch-studio.ps1             # Windows PowerShell 启动器
├── stop-studio-services.cmd      # 停止本地服务脚本
├── wrangler.jsonc                # Cloudflare Pages 配置
├── wrangler.api.jsonc            # Worker API 配置
├── vercel.json                   # Vercel 兼容配置
├── package-lock.json
└── package.json
```
