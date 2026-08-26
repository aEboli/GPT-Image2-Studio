# GPT-Image2-Studio

<div align="center">

[![Version](https://img.shields.io/badge/version-v0.2.10-2563eb.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)
[![Windows](https://img.shields.io/badge/Windows-Installer-0078d4.svg)](https://github.com/aEboli/GPT-Image2-Studio/releases)

**本地优先的 AI 图像生成与视觉创作工作台**

把提示词生图、参考图分析、图片编辑、电商套图、人物写真、文章插图、PPT 生成和素材管理集中到一个浏览器界面中。

当前版本：`v0.2.10`

</div>

## v0.2.10 更新说明

- 纯文档更新：把 README 中滞留的 v0.2.8 版本事实对齐到当前版本，包括徽章、本章节、桌面安装包与免安装 ZIP 文件名、发行说明链接和构建产物路径。

### v0.2.9 新增

- 所有生图入口使用同一个圆形水滴加载组件：提示词生图、风格迁移、电商套图、写真、文章插图、PPT 页面、图片拆解、融图分析、图片编辑和快速溶图。
- 水滴按真实液体呈现：液面波峰叠加反向涟漪持续横向流动，液体内有上升气泡，液位在两次百分比之间连续上涨而不是逐格跳变。
- 百分比分段推进：`20%` 及以内每 `1%` 间隔 `800ms`；超过 `20%` 后每跨一个 `10%` 区间，单次 `1%` 的间隔再增加 `1500ms`（`21%–30%` 为 `2300ms`，`91%–99%` 为 `12800ms`），封顶 `99%` 直到完整图片可用。
- 新增排队等待态：排队中尚未开始生成的任务不显示也不推进百分比、不安排计时器，改用静水加缓慢呼吸涟漪，标签显示“排队等待中”；任务真正开始生成后切换为生成态并从 `0%` 起算。
- 队列条带与缩略图条带中占位一致的相邻条目增加可见分隔。
- `prefers-reduced-motion: reduce` 下停用呼吸、波峰流动、气泡和等待涟漪动画，液位与百分比文本仍随进度更新。
- 套图最终图分块投递，失败与异常响应的恢复路径收紧，并新增生成图校验模块。
- 修复直连路线的多参考图编辑，参考图关系不再在多图场景下错位。
- 提示词生图队列增加容量限制，超出并发时进入本地队列而不是直接拒绝。
- 提示词多次尝试的预览卡组在重试后保留历史尝试，不再被覆盖。

### v0.2.8 更新

- 工作台左下角新增当前版本号；主应用后续每次更新统一递增 `0.0.1`，并自动同步锁文件、页面和当前发行文档，商品图采集扩展仍使用独立版本线。
- Prompt Kit 会将可复用的长期 Prompt Agent 历史补齐为稳定的本地模板，不覆盖用户已经编辑的模板，也不会重新创建用户主动删除的模板。桌面端面板贴近提示词参数列展开，悬浮和键盘焦点提示始终显示在面板与弹窗之上。
- 提示词生图保留首次载入的最近 10 张图片基线，只在本页成功生成后逐张追加，最多显示 50 张缩略图；加载预览改为连续、随阶段变化的液体动效，但不会把视觉动效伪装成生成进度。
- 图片详情在横图、方图和竖图之间保持稳定的桌面外框；结构化提示词的数组值按共同字段聚合，便于连续检查与复用。
- 套图记录支持勾选多套记录生成 Temu 标准 Excel：每个 SKU 独占一行，已存在的公网 HTTPS 图片会直接复用；本地图片可选择使用 Cloudinary unsigned upload 获取 `secure_url`。
- 缺少 Listing、价格、尺寸、重量、库存、产地或可公开访问图片时，导出文件会保持对应单元格为空，并在“导出问题”工作表列出具体待补项，不会猜测或伪造商品事实。
- 导出仅在本地 Node.js 或 Windows 桌面程序中可用；它不会登录、导入或发布到 Temu。上传前仍需人工核对工作簿与 Temu 的实际校验结果。
- Creation 与 Listing 的兼容读取、SKU 颜色标签和套图生成规则得到完善，历史记录仍按既有字段来源和数据边界处理。
- 套图记录页在桌面宽屏恢复为左侧可持续加载记录列表、右侧图片与 Listing 的双栏工作区；搜索、日期筛选、多选、加载更多和当前详情彼此保持独立，移动端改为可折叠的记录选择器。
- Listing 生成进一步收紧证据边界，补齐可验证标题信息、商品/包装尺寸重量来源和历史记录兼容读取；买家可见标题与 SKU 图片文件名不会暴露内部货号或源文件编码。
- 提示词模式支持分别清空参考图和提示词、从当前结果添加或拖入参考图，首次载入显示最近 10 张图片，当前会话仅随成功生成结果逐张扩展，历史缩略图最多保留 50 张且不回填更早历史；图片详情参数页同时展示文件名与相对路径。
- Vercel Serverless 使用生产依赖安装和标准请求处理入口，避免 Electron 依赖与本地监听回调阻塞云端函数；Vercel 使用临时文件系统，不提供本地持久化工作流。
- Responses 流式连接中断后，主应用会先按原始 response ID 限次回查；仍无法确认最终结果时，会复用当前任务的原输入自动重试一次，并显示“重试中”，重试耗尽后不会继续发送第三次请求。
- 提示词模式支持最多 15 个未完成任务，并在提示词相关路由之间共享 10 个并发槽位；主预览区域仍保持紧凑的视觉边界。
- 已移除 Cloudflare Pages/Worker/R2/Queue 的当前部署路径和活动文档声明；当前继续维护本地 Node.js、Windows 桌面程序、Windows 浏览器安装包和 Vercel 运行方式。

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
| Windows 桌面程序 | 需要独立窗口、任务栏和标准安装卸载的 Windows 用户 | Electron 内置运行时，动态回环端口，关窗即停止服务 |
| Windows 浏览器安装包 | 需要保留旧版浏览器启动方式的 Windows 用户 | 内置 `node.exe`，安装后通过快捷方式打开默认浏览器 |

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

- **电商套图**：按平台、类目、商品事实、受众和 SKU 生成推荐轮播计划，支持套图级参数覆盖、兼容图片类型启停、Logo、补图队列和 Listing 草稿；通用电商保留 18 个原生轮播槽位。
- **写真模式**：组合人物、动作、服装、道具和地点，生成 1 到 100 张系列写真。
- **文章插图**：解析文章包，建立风格、角色和场景设定，再生成正式插图计划。
- **PPT 生成**：从主题或文档生成 1 到 20 页演示文稿，支持单页编辑、补图、普通 PPTX 和可编辑重建导出。

### 资产与任务

- 瀑布画廊和图片详情灯箱，支持缩放、平移、下载和参数复盘。
- 套图、写真、文章插图和 PPT 独立记录页。
- 生成队列、后台任务状态、错误信息和失败项重试。
- Prompt Kit、Prompt Agent 图片转提示词、Logo 素材库、写真搭配库和模型选择器。
- 深色/浅色主题、中英文界面和跨桌面/平板/手机布局。

## 真实界面预览

以下截图来自当前版本的真实隔离浏览器页面。截图用于展示界面结构，示例输入与预览内容不代表上游模型的固定输出。

### 提示词生图

上传参考图、编写或增强提示词，并在同一工作台设置比例、分辨率和输出格式。

![提示词生图页面](./docs/images/studio-prompt.jpg)

### 风格迁移

分别管理原图和风格参考图，也可以直接选用内置风格预设。

![风格迁移页面](./docs/images/style-transfer.jpg)

### 图片编辑

支持整图编辑，以及在画布上绘制多个局部区域并为每个区域填写修改要求。

![图片编辑页面](./docs/images/image-edit.jpg)

### 电商套图

从商品事实、参考图和目标平台生成套图计划，再检查计划并批量执行。

![电商套图页面](./docs/images/creation-suite.jpg)

### 写真模式

组合人物、动作、服装道具、地点、摄影风格和景别，生成一致的系列写真。

![写真模式页面](./docs/images/portrait-mode.jpg)

### 文章插图

先解析文章和建立风格圣经，再生成角色/场景参考图与正文分镜插图。

![文章插图页面](./docs/images/article-illustration.jpg)

### PPT 生成

从文档、文本或主题生成大纲与页面图片，并导出 PPTX。

![PPT 生成页面](./docs/images/ppt-generation.jpg)

### 瀑布画廊

集中浏览各工作流的生成结果，通过筛选、列数切换和详情灯箱进行复盘。

![瀑布画廊页面](./docs/images/gallery.jpg)

## 页面介绍

### 创作页面

| 页面 | 入口 | 输入 | 核心流程 | 输出与管理能力 |
| --- | --- | --- | --- | --- |
| 提示词生图 | `#studio`，创作 -> 提示词生图 | 提示词、最多 15 张参考图、比例、分辨率、格式、增强开关 | 可从模板开始，先增强提示词，再提交后台生成任务并接收进度 | PNG/JPG 生成图、实时预览、胶片条切换、下载、删除、灯箱查看和参数复盘 |
| 风格迁移 | `#style-transfer`，创作 -> 风格迁移 | 1 张原图；1 张风格参考图或一个内置风格预设；补充提示词 | 分离主体内容与风格来源，将参考关系和提示词一起交给当前生图通道 | PNG/JPG 结果、预览与下载；任务同时进入统一生成队列和画廊 |
| 融图分析 | `#reference-analysis`，创作 -> 融图分析 | 1 到 15 张图片、分析语言、目标描述 | 先分析每张图的主体、角色、关系和风险，再形成融合提示词；确认后生成目标图 | 结构化分析卡片、可应用的融合提示词、PNG/JPG 结果与历史资产 |
| 图片拆解 | `#image-decomposition`，创作 -> 图片拆解 | 1 张产品、设备或包装图，拆解方向和补充要求 | 识别结构、部件、卖点和信息层级，构造说明图/信息图提示词后生成 | 拆解分析、PNG/JPG 说明图、胶片条预览、下载和画廊归档 |
| 图片编辑 | `#image-edit`，创作 -> 图片编辑 | 1 张源图；整图修改文字，或多个局部蒙版及逐区指令 | 整图模式直接编辑；局部模式将蒙版与源图规范化为同尺寸 PNG，可合并执行或逐区顺序执行 | PNG/JPG 编辑结果、局部区域管理、重试、下载、灯箱和画廊记录 |
| 快速融图 | `#quick-blend`，创作 -> 快速溶图 | A/B 两组必选图片，C/D 两组可选；布局、位置形状、比例和分辨率 | 按相同序号配对；A/B 数量必须一致，启用的 C/D 也必须与 A/B 一致；每一对形成独立生成任务 | 每对一张 PNG/JPG 结果，可重排、移除整对、查看进度、下载和归档 |
| 图片压缩 | `#image-compress`，创作 -> 图片压缩 | 多张浏览器可解码图片；质量或目标大小、输出格式、可选目标宽高 | 完全在浏览器本地以 Canvas 解码、等比缩放留边并重新编码，不上传到生图服务 | 保留原格式或转换为 PNG/JPEG/WebP；显示前后体积、压缩率、像素尺寸并逐张下载 |
| 电商套图 | `#creation`，创作 -> 套图模式 | 商品事实、最多 15 张产品参考图、平台、类目、SKU、语言、Logo 与计划覆盖项 | 智能识别参考图角色，按 19 种平台画像生成轮播计划，可覆盖套图级语言、比例和分辨率并启停兼容图片类型，再并发生成 | 套图、队列、按冻结计划补齐失败项、Logo 批处理、Listing 草稿及套图记录 |
| 写真模式 | `#portrait`，创作 -> 写真模式 | 人物图、动作图、服装道具配饰图、人物描述、地点、风格、景别和数量 | 先建立人物一致性和拍摄计划，再按动作、景别、地点与风格组合生成 | 1 到 100 张 PNG/JPG 写真、计划预览、失败项重试、写真记录和素材复用 |
| 文章插图 | `#article-illustration`，创作 -> 文章插图 | 正文、补充说明，或多个 TXT/MD/CSV/JSON 文件；内容类型和风格预设 | 整体解析文章，建立风格圣经、人物/场景参考卡和阅读顺序分镜；可先生成参考图再生成正文插图 | PNG 参考图和正文插图、分镜编辑、说明文字、重新生成及文章插图记录 |
| PPT 生成 | `#ppt`，创作 -> PPT生成 | PDF/DOCX/PPTX/TXT/MD/CSV 文档、直接文本或主题；1 到 20 页、视觉与动态预设 | 分析材料，生成大纲与逐页提示词，再以固定 16:9 画布生成页面；支持缺页补齐和单页编辑 | 页面 PNG、整页图片型 PPTX、可编辑重建 PPTX、单页补图/编辑以及 PPT 记录 |

### 资产与记录页面

| 页面 | 入口 | 输入/筛选 | 核心流程 | 输出与管理能力 |
| --- | --- | --- | --- | --- |
| 瀑布画廊 | `#gallery`，资产 -> 瀑布画廊 | 工作流、日期、关键词和列数 | 合并服务端记录与浏览器缓存，按筛选条件构建瀑布流 | 灯箱缩放/平移、前后切换、下载、复制路径、查看完整参数，以及删除当前或勾选图片 |
| 文章插图记录 | `#article-record`，资产 -> 文章插图记录 | 记录搜索、列数、文章插图集 | 按文章集加载参考卡、正文插图、标题和说明文字 | 继续创作、复制说明、逐图查看/下载和重新生成，以及删除当前或勾选记录 |
| 套图记录 | `#creation-record`，资产 -> 套图记录 | 商品/平台搜索、创建时间与已保存套图 | 按关键词、今天、近 7 天、更早或精确日期筛选，恢复生成快照、有效计划、进度、Listing 和逐图结果 | 导出 TXT/JSON、勾选多套记录导出 Temu 标准 Excel、按冻结计划补齐缺失项、查看灯箱和下载；支持删除当前、勾选批量删除和按显式筛选结果删除 |
| 写真记录 | `#portrait-record`，资产 -> 写真记录 | 写真集搜索与已保存计划 | 恢复人物、地点、风格、景别、动作和生成进度 | 导出 JSON、重试失败项、查看/下载结果、继续创作，以及删除当前或勾选记录 |
| PPT 记录 | `#ppt-record`，资产 -> PPT记录 | 已生成演示文稿列表 | 读取大纲、页面缩略图、导出文件和完成状态 | 逐页预览、下载 PPTX、继续补页或进入单页编辑器，以及删除当前或勾选记录 |

### Temu 快速上架 Excel

在“套图记录”勾选一套或多套记录后，使用“导出 Temu Excel”生成基于项目内置标准模板的 `.xlsx`。每个 SKU 独占一行；已有的公网 HTTPS 图片链接会直接写入模板，本地输出图片可选使用 Cloudinary unsigned upload 转成 `secure_url`。`cloudName` 与 `uploadPreset` 不是 API Secret，应用不会收集或保存 Cloudinary API Key、API Secret、签名、Authorization 或 Cookie。

这项能力只在本地 Node.js 或 Windows 桌面运行时可用，不会自动登录、导入或发布到 Temu。缺少 Listing、价格、尺寸、重量、库存、产地或公网图片时，导出的工作簿会保留空单元格，并在“导出问题”工作表列出待补全项目；上传前仍需人工核对模板和 Temu 的实际校验结果。Cloudinary 远端资源的配额、生命周期和删除由 Cloudinary 账户自行管理。

## 重要工具与弹窗

| 工具 | 入口 | 能力与数据去向 |
| --- | --- | --- |
| 图片详情灯箱 | 生成预览中的“查看”，或点击画廊/记录页图片 | 支持适配、缩放、平移、前后切换、下载、删除、复制相对/完整路径，并展示提示词、模型、比例、尺寸和工作流快照 |
| Prompt Agent | 顶栏“图片转提示词”，或创作菜单中的同名入口 | 上传 1 张图片，分析为可复制的 JSON 提示词；历史记录长期保存在当前运行环境的数据存储中 |
| 商品图采集插件 | 创作 -> 工具 -> 商品图采集插件 | 鼠标悬停或键盘聚焦名称可查看完整说明；点击后下载 Chrome/Edge 插件 ZIP，用于从受支持商城详情页采集主图、详情图和 SKU 图，再复制到 Studio、批量复制到聊天软件或按商品文件夹下载 |
| 连接配置 / 生成日志 | 顶栏“配置”，或配置菜单 -> 生成日志 | 在路由模式、直接调用模式和“Gemini模型”之间切换，分别管理端点、API Key、文本/视觉模型和生图模型，并可获取模型、测试连接和保存浏览器私有配置；日志会展示当前会话的通道、时间、参数摘要、进度、结果和错误，用于定位上游超时、协议不兼容或无最终图片等问题 |
| Prompt Kit | 提示词输入区的模板按钮 | 从内置模板开始组织主体、场景、构图和视觉语言，再把模板内容带回提示词编辑区继续修改 |
| Logo 库 | 套图模式的 Logo 控件 | 上传、长期保存、选择和删除常用 Logo；可设置位置和背景策略，也可对最多 15 张上传图执行同一 Logo 批处理 |
| 写真搭配库 | 写真模式 -> 服装道具配饰参考图 -> 搭配库 | 保存并复用服装、道具和配饰素材，将选中素材带入写真参考图与提示词摘要 |
| PPT 单页编辑器 | PPT 生成结果或 PPT 记录中的页面编辑操作 | 对指定页填写修改要求并重新生成，保留演示文稿上下文；也可补齐缺失页面后重新导出 |
| 打开输出目录 | 顶栏或资产菜单 -> 打开输出目录 | 本地 Node.js/Windows 运行时打开实际图片根目录；Vercel 等云端环境不提供本机目录打开能力 |

### 商品图采集插件

该浏览器扩展支持 1688、Amazon、Temu、TikTok Shop、SHEIN 和大健云仓消费者商品详情页。它按平台边界识别主图、详情图和带名称的 SKU 图，提供分组筛选、原图预览、复制到 Studio、Windows 多文件“复制图片”、单图下载和按商品文件夹批量下载；页面结构不受支持时会停止，不扫描整页图片。“复制图片”由扩展专用的 Windows Native Messaging 助手完成，不要求启动或打开 Studio；单批最多支持 1000 张，成功后插件内会短暂显示半透明提示，当前选中图片可一次粘贴到聊天软件。

扩展只在用户主动点击采集后读取已支持的商品区域，不读取 Cookie、API Key、密码或其他登录凭据。Studio 菜单只负责生成并下载可审查的 ZIP，不会静默安装或更新浏览器扩展；Chrome/Edge 仍需用户在扩展管理页确认加载或重载，本地剪贴板助手也需用户运行包内安装脚本。详细安装、平台路由和操作说明见 [商品图采集插件说明](./extensions/product-image-collector/README.md)。

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

### 方式二：Windows 桌面程序（推荐）

从包含桌面产物的 [GitHub Releases](https://github.com/aEboli/GPT-Image2-Studio/releases) 下载：

```text
GPT-Image2-Studio-Desktop-Setup-v0.2.10-x64.exe
```

安装完成后通过桌面或开始菜单中的 `GPT-Image2-Studio` 启动。程序会在独立窗口中运行，内置服务使用动态回环端口，关闭窗口后不会遗留后台服务。无需另行安装 Node.js，完整说明见 [Windows 桌面程序文档](./docs/windows-desktop.md)。

源码目录也可直接启动桌面开发版：

如果不想安装，可下载同一 Release 中的 `GPT-Image2-Studio-Portable-v0.2.10-x64.zip`，完整解压后直接运行压缩包根目录的 `GPT-Image2-Studio.exe`。便携版不创建安装项或卸载记录，运行时请保持解压后的文件结构完整。

桌面开发使用 Electron `43`，要求 Node.js `22.12` 或更高版本；普通 `npm start` 服务仍支持 Node.js `20+`。

```powershell
cmd /c npm ci
cmd /c npm run desktop
```

### 方式三：Windows 浏览器安装包（兼容旧版）

旧版浏览器安装流程仍保留本地构建说明，但 `v0.2.10` GitHub Release 不附带 IExpress 兼容安装包。请优先使用上面的 Windows 桌面安装包或免安装 ZIP；只有需要自行构建兼容流程时，再参考 [Windows 浏览器安装包文档](./docs/windows-installer.md)。

## 配置说明

### 在界面中配置 API

首次启动后打开顶部的“配置”，按服务提供方填写。**直接调用模式**会把配置分成两组：生图 API 和文本/视觉 API。两组分别填写自己的 Base URL、API Key、接口后缀和模型；生图组只负责图片生成/编辑，文本/视觉组负责提示词、参考图、Listing 等分析调用。API Key 只保存在本地私有配置中，公共配置接口只返回是否已配置和脱敏掩码。两个“获取模型列表”和“测试连接”操作也会按当前组使用对应 API。

已存在的配置仍兼容 `directBaseUrl`、`directApiKey`、`directEndpointPath`、`directImageModel`、`directResponsesModel`。新填写的用途专属字段按组独立优先；API Key 留空表示保留之前保存的私有 Key，不会清除它。

| 配置项 | 说明 |
| --- | --- |
| Base URL | 例如 `https://api.openai.com/v1`，也可填写兼容服务地址 |
| API Key | 对应服务的访问密钥 |
| 接口后缀 | 常见值为 `responses`、`images/generations`、`images/edits` 或 `chat/completions` |
| 模型 | 按当前通道选择 Responses 模型、直接图片模型或兼容协议模型 |
| 调用通道 | 路由模式、直接调用模式或“Gemini模型”模式 |
| 直接调用 - 生图 API | 独立填写 Base URL、API Key、接口后缀和生图模型 |
| 直接调用 - 文本/视觉 API | 独立填写 Base URL、API Key、接口后缀和文本/视觉模型 |

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
RESPONSES_MODEL=gpt-5.4-mini
DIRECT_IMAGE_BASE_URL=https://api.openai.com/v1
DIRECT_IMAGE_API_KEY=
DIRECT_IMAGE_ENDPOINT_PATH=images/generations
DIRECT_IMAGE_MODEL=gpt-image-2
DIRECT_TEXT_BASE_URL=https://api.openai.com/v1
DIRECT_TEXT_API_KEY=
DIRECT_TEXT_ENDPOINT_PATH=responses
DIRECT_TEXT_MODEL=gpt-5.4-mini

HOST=
IMAGE_STUDIO_REQUEST_TOKEN=
IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP=0

IMAGE_STUDIO_DISABLE_DNS_FALLBACK=0
IMAGE_STUDIO_DNS_FALLBACK_SERVERS=
```

| 变量 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | 默认 API Key |
| `OPENAI_BASE_URL` | 默认 API Base URL |
| `RESPONSES_MODEL` | 默认 Responses 模型，未配置时为 `gpt-5.4-mini`；应以实际服务支持的模型为准 |
| `DIRECT_IMAGE_BASE_URL` / `DIRECT_IMAGE_API_KEY` / `DIRECT_IMAGE_ENDPOINT_PATH` / `DIRECT_IMAGE_MODEL` | 直接调用模式的生图 API 配置；分别对应地址、密钥、接口后缀和生图模型 |
| `DIRECT_TEXT_BASE_URL` / `DIRECT_TEXT_API_KEY` / `DIRECT_TEXT_ENDPOINT_PATH` / `DIRECT_TEXT_MODEL` | 直接调用模式的文本/视觉 API 配置；分别对应地址、密钥、接口后缀和文本/视觉模型 |
| `DIRECT_BASE_URL` / `DIRECT_API_KEY` / `DIRECT_ENDPOINT_PATH` / `DIRECT_RESPONSES_MODEL` | 旧版直接调用变量，仅用于兼容回退；新配置请使用上面两组变量 |
| `PORT` | 本地服务端口，默认 `3600` |
| `HOST` | 监听地址；留空时为 `127.0.0.1` |
| `IMAGE_STUDIO_OUTPUT_DIR` | 自定义生成文件根目录 |
| `IMAGE_STUDIO_LOCAL_DATA_DIR` | 自定义本地配置和记录根目录 |
| `IMAGE_STUDIO_REQUEST_TOKEN` | 固定所有非回环请求使用的远程访问令牌 |
| `IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP` | 设为 `1` 时显式允许非回环地址直接使用未加密 HTTP；默认拒绝 |
| `IMAGE_STUDIO_DISABLE_DNS_FALLBACK` | 设为 `1` 时禁用 Node DNS fallback |
| `IMAGE_STUDIO_DNS_FALLBACK_SERVERS` | 自定义 fallback DNS，支持逗号、分号或空白分隔 |
| `IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS` | 套图单项上游请求的最长时间，默认 `900000`（15 分钟）；有效范围为 1 秒到 1 小时，超出会被收敛到边界 |
| `IMAGE_STUDIO_ENABLE_TEST_MOCKS` | 仅测试用途。必须与 `IMAGE_STUDIO_MOCK_IMAGE_GENERATION=1`、`IMAGE_STUDIO_OUTPUT_DIR` 和 `IMAGE_STUDIO_LOCAL_DATA_DIR` 同时设置，才会启用本地假图生成；缺一即忽略并打印告警 |

真实 `.env` 已被 `.gitignore` 排除，但仅创建该文件不会让本地服务自动读取它。云端部署请使用平台 Secret 或环境变量，不要把密钥写入仓库。

### 局域网访问与请求令牌

本地服务默认仅监听回环地址。远程访问推荐保持 `HOST` 为空，由 TLS 反向代理连接 `127.0.0.1`。该模式应在启动前显式设置固定的 `IMAGE_STUDIO_REQUEST_TOKEN`，由反向代理完成外部认证，并向每个后端请求注入同一个 `X-Image-Studio-Token` 或 Bearer 令牌。

仅在隔离且可信的网络中需要保留直接局域网 HTTP 兼容时，才显式设置：

```powershell
$env:HOST="0.0.0.0"
$env:IMAGE_STUDIO_REQUEST_TOKEN="<strong-random-token>"
$env:IMAGE_STUDIO_ALLOW_INSECURE_REMOTE_HTTP="1"
cmd /c npm start
```

该兼容模式不会加密 HTTP Basic、Bearer、提示词或生成资产，局域网监听者可以读取这些内容。没有显式开启兼容变量时，非回环 `HOST` 会在监听前失败。

在显式开启的直接局域网 HTTP 兼容模式下，远程浏览器首次访问时会显示 HTTP Basic 登录框：用户名固定为 `studio`，密码为当前远程访问令牌。认证后，浏览器会为同源页面、静态资源、API 和输出文件复用凭据。

命令行与代理可以使用任一请求头：

```text
Authorization: Bearer <strong-random-token>
X-Image-Studio-Token: <strong-random-token>
```

所有非回环 Host 请求都必须认证，同源请求头和回环代理连接不能绕过认证。只有回环 socket 与回环 Host 同时成立时才保留免登录体验。后端会故意拒绝无令牌的“回环 socket + 非回环 Host”请求，不会为这类请求发起 Basic 登录挑战，因此 TLS 反向代理不能依赖后端弹出登录框。

如果没有设置 `IMAGE_STUDIO_REQUEST_TOKEN`，服务会在每次启动时随机生成令牌并打印到终端；反向代理必须在远程访问前同步该令牌并重新加载配置。长期运行的反向代理应显式配置固定强令牌，避免每次服务重启后代理继续发送已失效的旧值。

### Node DNS fallback

Node 服务优先使用系统默认的 `dns.lookup`。只有系统解析上游域名失败时，才会尝试备用解析器；内置候选包括 `223.5.5.5`、`1.1.1.1` 和系统已有 DNS 服务器。

```powershell
# 禁用 fallback
$env:IMAGE_STUDIO_DISABLE_DNS_FALLBACK="1"

# 自定义备用 DNS
$env:IMAGE_STUDIO_DNS_FALLBACK_SERVERS="1.1.1.1,8.8.8.8"
```

## 部署方式

### Vercel

仓库中的 `vercel.json` 为 `server.mjs` 配置了依赖包含范围和 `300` 秒函数时长，并在云端安装时使用 `npm ci --omit=dev`，避免把仅供桌面开发的 Electron/Electron Builder 带入 Serverless Function。可通过 Vercel 导入仓库或 CLI 创建 Preview 部署：

```powershell
vercel deploy
```

确认预览环境中的静态资源、API、SSE 和长任务后再发布：

```powershell
vercel deploy --prod
```

Vercel 运行时的输出和本地数据目录位于临时文件系统，实例回收后可能丢失。需要长期保存图片和历史时，优先使用本地运行，或为云端接入持久化存储。

### 构建 Windows 桌面程序

在 Windows x64 和 Node.js `22.12+` 环境运行：

```powershell
cmd /c npm ci
node --test test/desktop-application.test.mjs
cmd /c npm run test:desktop-smoke
cmd /c npm run build:desktop
```

产物路径：

```text
artifacts/desktop/GPT-Image2-Studio-Desktop-Setup-v0.2.10-x64.exe
artifacts/desktop/GPT-Image2-Studio-Portable-v0.2.10-x64.zip
artifacts/desktop/win-unpacked/GPT-Image2-Studio.exe
```

桌面版使用 Electron 独立窗口和 Electron Builder NSIS 安装包。完整说明见 [Windows 桌面程序文档](./docs/windows-desktop.md)。

### 构建 Windows 浏览器安装包（兼容旧版）

在 Windows 上运行：

```powershell
cmd /c npm ci
cmd /c npm run build:installer
```

产物路径格式：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.2.10.exe
```

脚本使用系统 `iexpress.exe` 生成自解压安装包，并把当前 Node.js 运行时和依赖打入安装目录；启动后仍使用默认浏览器显示工作台。

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

## 参数、分辨率与限制

> [!IMPORTANT]
> 下表描述的是当前应用提供的候选值、工作流约束和平台保守建议，不代表所有上游模型、兼容网关或电商平台都官方支持这些尺寸、数量和策略。实际接受的参数、计费、输出像素、图片格式和平台审核规则，以所选服务与目标平台当前规则为准。第三方网关可能忽略、改写或拒绝应用传入的参数。

### 比例与像素尺寸候选

路由模式和直接调用模式共享以下应用内像素候选。“自动适配”会取该比例的基础尺寸；“其余候选”按界面从低到高列出，不包含基础与最大值。

| 比例 | 常见用途 | 基础尺寸 | 其余候选 | 最大候选 |
| --- | --- | --- | --- | --- |
| `1:1` | 电商主图、头像、社交媒体 | `1024x1024` | `1536x1536`、`2048x2048`、`2560x2560` | `2880x2880` |
| `4:3` | PPT、网页配图 | `1360x1024` | `2048x1536`、`2720x2048` | `3312x2480` |
| `3:4` | 海报、人像 | `1024x1360` | `1536x2048`、`2048x2720` | `2480x3312` |
| `3:2` | 横版摄影 | `1536x1024` | `2304x1536`、`3072x2048` | `3520x2352` |
| `2:3` | 竖版摄影 | `1024x1536` | `1536x2304`、`2048x3072` | `2352x3520` |
| `5:4` | 商品展示 | `1280x1024` | `1920x1536`、`2560x2048` | `3200x2560` |
| `4:5` | 竖版社交帖子 | `1024x1280` | `1536x1920`、`2048x2560` | `2560x3200` |
| `16:9` | 横版封面、视频封面 | `1824x1024` | `2736x1536`、`3648x2048` | `3840x2160` |
| `9:16` | 短视频封面、手机壁纸 | `1024x1824` | `1536x2736`、`2048x3648` | `2160x3840` |
| `21:9` | 超宽横幅 | `2384x1024` | `1680x720`、`3584x1536` | `3840x1648` |
| `9:21` | 超长竖图 | `1024x2384` | `720x1680`、`1536x3584` | `1648x3840` |
| `2:1` | Banner 横幅 | `2048x1024` | `3072x1536` | `3840x1920` |
| `1:2` | 长海报 | `1024x2048` | `1536x3072` | `1920x3840` |
| `3:1` | 超宽广告图 | `3072x1024` | 无 | `3840x1280` |
| `1:3` | 超长竖版广告 | `1024x3072` | 无 | `1280x3840` |

### 三种调用通道的尺寸差异

| 界面名称 | 典型协议 | 应用提供的尺寸参数 | 自动值 | 重要限制 |
| --- | --- | --- | --- | --- |
| 路由模式 | Responses API + 图像工具 | 上表中与比例绑定的明确像素值 | 当前比例的基础尺寸 | 端点固定为 `responses`；最终像素仍可能被上游调整 |
| 直接调用模式 | `images/generations`、`responses` 或 `chat/completions` | 与路由模式相同的明确像素值 | 当前比例的基础尺寸 | 兼容程度取决于网关和模型；图片编辑请求可能改走 `images/edits` |
| Gemini模型 | Gemini 图片生成形态；非 Gemini 模型可走模型 `chat/completions` 兼容形态 | `512`、`1K`、`2K`、`4K` | `1K` | 尺寸是档位而非承诺像素；默认模型名为 `gemini-3.1-flash-image-preview`，仅表示应用默认值，不保证服务端存在；不同模型/网关可能不接受参考图、比例或 `4K` |

“Gemini模型”是当前界面的通道名称，不等同于“任意 Gemini API 都完整兼容”。Studio 会根据模型名选择图片生成或聊天兼容请求体，连接测试通过也不保证所有生图工作流和最大尺寸都可用。

### 工作流上传与数量限制

| 工作流 | 上传/数量限制 | 补充说明 |
| --- | --- | --- |
| 提示词生图 | 参考图最多 15 张 | 单个会话并行任务槽上限为 15；不等于上游并发额度 |
| 风格迁移 | 原图 1 张；风格参考图 1 张或选择内置预设 | 有内置预设时可不上传风格图；原图仍是独立输入 |
| 融图分析 | 1 到 15 张图片 | 分析后再确认是否生成，生成结果计入统一队列 |
| 图片拆解 | 1 张源图 | 一次围绕一张产品/设备/包装图生成拆解结果 |
| 图片编辑 | 1 张源图；局部模式每个上传蒙版不超过 50 MB | 源图与蒙版会规范化为同尺寸 PNG；50 MB 限制针对局部蒙版文件，不是对普通源图的统一承诺 |
| 快速融图 | A/B 各至少 1 张且数量相同；C/D 可选，启用后数量也必须与 A/B 相同 | 当前应用未另设每组固定张数上限；批量规模仍受浏览器内存、15 个会话任务槽和上游限流影响 |
| 图片压缩 | 可一次选择多张浏览器可解码图片 | 当前应用未设固定张数上限；全部在浏览器内逐张处理，数量和像素过大会增加内存占用 |
| 电商套图 | 产品参考图最多 15 张；Logo 最多 1 张；上传图加 Logo 的源图最多 15 张 | 命名平台推荐轮播为 6 到 9 张且不得超过各自原生槽位上限；通用电商保留 18 个原生轮播槽位 |
| 电商 SKU | SKU 组合数量最多 20 | 冻结计划最多 64 项、序列化后最多 4 MiB，属于内部提交保护上限 |
| 写真模式 | 人物参考图最多 3 张；动作参考图最多 3 张；服装/道具/配饰最多 9 张；生成 1 到 100 张 | 默认 12 张；高数量任务应先用小批量验证人物一致性和通道稳定性 |
| 文章插图 | 正文、补充说明或多个文本文件；插图数量由文章结构和节奏规划 | 没有固定插图张数选择器；先生成参考卡可提升人物与场景一致性 |
| PPT 生成 | 可上传多个文档；页数 1 到 20，默认 8 | 可从文档、文本或主题三种来源开始；大文件解析能力取决于本地解析器和上游上下文限制 |

### 19 种平台推荐策略

平台表来自应用内版本 `2026-07-18.1` 的策略画像。推荐轮播数只统计平台画像的默认轮播槽位，不含按 SKU 追加的图片、信息图重构项或用户手动新增项。

| 平台 | 推荐轮播 | 分辨率档位 | 目标语言 | 证据级别 |
| --- | ---: | --- | --- | --- |
| 通用电商 | 18 | `1.5K` | English | baseline |
| Amazon | 7 | `2K` | English | A |
| 淘宝/天猫 | 8 | `2K` | 简体中文 | A |
| 京东 | 8 | `2K` | 简体中文 | B |
| 拼多多 | 8 | `1.5K` | 简体中文 | C |
| 抖音电商 | 6 | `1.5K` | 简体中文 | C |
| 小红书电商 | 6 | `1.5K` | 简体中文 | B |
| Temu | 8 | `1.5K` | English | B |
| TikTok Shop | 6 | `1.5K` | English | A |
| Shopee | 9 | `1.5K` | English | A |
| Lazada | 8 | `1.5K` | English | C |
| Etsy | 8 | `2K` | English | A |
| eBay | 8 | `2K` | English | A |
| Walmart | 6 | `max` | English | A |
| Shopify/DTC | 8 | `2K` | English | A |
| AliExpress | 8 | `1.5K` | English | C |
| Rakuten | 8 | `2K` | 日本語 | C |
| Coupang | 8 | `2K` | 한국어 | C |
| Mercado Libre | 8 | `1.5K` | Español | C |

证据级别含义：`A` 表示画像主要有官方规则或官方指南支撑；`B` 表示只有部分官方资料、真实页面或登录态观察；`C` 表示公开细则不足时采用的保守建议；`baseline` 是应用通用基线，不代表任何命名平台的官方要求。策略最后核对日期为 `2026-07-11`，平台规则可能随时变化，上架前仍需复查目标站点最新要求。

### 固定工作流参数

| 工作流 | 固定或默认参数 | 说明 |
| --- | --- | --- |
| 文章插图 | `3:2`、`auto`、PNG | 页面没有单独尺寸控件；路由/直接通道的 `auto` 基础值为 `1536x1024`，Gemini模型通道的 `auto` 为 `1K` |
| PPT 页面 | `16:9`、请求尺寸 `2048x1152`、PNG | 最终有效尺寸可能由上游调整；导出时使用实际保存的页面图片 |
| 写真模式 | 默认 12 张、`4:5`、PNG | 数量可改为 1 到 100，比例/尺寸/格式可在页面调整 |
| 电商套图 | 默认 PNG；平台画像决定默认比例、档位、语言和图片类型 | 用户显式设置的套图级语言、比例、分辨率和兼容类型状态以提交时冻结的有效计划为准 |
| 普通 AI 生图 | 默认格式 PNG，用户可改 JPG | 应用向 API 传递 JPG 时使用 `jpeg`，本地保存扩展名为 `.jpg` |

### 文件与格式支持

| 用途 | 输入格式 | 输出格式/说明 |
| --- | --- | --- |
| 普通参考图、风格迁移、融图、拆解、编辑、套图、写真、Prompt Agent | 浏览器识别的 `image/*` | AI 生成结果仅提供 PNG 或 JPG；实际输入解码和上游接受范围取决于浏览器与接口 |
| 图片编辑局部蒙版 | 图片文件，每个不超过 50 MB | 服务端规范化为与源图同尺寸的 PNG 蒙版，再按合并或顺序策略编辑 |
| 图片压缩 | 浏览器可解码的图片，界面提示 JPG/PNG/WebP 等 | 可保留原格式，或输出 PNG、JPEG、WebP；JPEG/WebP 支持质量/目标体积控制，PNG 不支持有损质量参数 |
| 文章插图材料 | TXT、MD、CSV、JSON，可多选；也可直接粘贴正文 | 参考卡和正文插图固定输出 PNG |
| PPT 材料 | PDF、DOCX、PPTX、TXT、MD、CSV，可多选；也可输入文本或主题 | 页面固定输出 PNG；可导出整页图片型 PPTX 或可编辑重建 PPTX |
| 套图/写真记录导出 | 应用内记录 | 套图可导出 TXT/JSON，勾选记录还可生成 Temu 标准 Excel；写真可导出 JSON。Temu Excel 需要本地运行、可用 HTTPS 图片链接和人工上传前核对 |

高分辨率、大文件和大批量任务更容易触发浏览器内存压力、上游超时、限流或“响应结束但没有最终图片”。建议先用自动适配或中等档位、小批量验证画面方向和协议兼容性，再提高尺寸或数量。

## 项目结构

```text
GPT-Image2-Studio/
|-- build/desktop/                # Windows 桌面应用图标资产
|-- desktop/                     # Electron 主进程与桌面安全策略
|-- docs/                         # 安装、设计和开发文档
|-- examples/                     # API 请求与 SSE 示例
|-- lib/                          # 服务端与前端共享逻辑
|-- openspec/                     # 变更规格、设计和验收场景
|-- public/                       # 浏览器界面、样式、模块与内置资产
|-- scripts/                      # 同步与安装包脚本
|-- test/                         # Node.js 测试
|-- generate-image.mjs            # 命令行单图生成入口
|-- server.mjs                    # 本地 Node.js 服务入口
|-- launch-studio.cmd             # Windows 快速启动器
|-- launch-studio.ps1             # Windows PowerShell 启动器
|-- stop-studio-services.cmd      # Windows 停止脚本
|-- vercel.json                   # Vercel 函数配置
|-- package-lock.json
`-- package.json
```

## 开发与验证

常用命令：

```powershell
# 启动开发服务
cmd /c npm run dev

# 启动 Electron 桌面开发版
cmd /c npm run desktop

# 查看命令行生图帮助
cmd /c npm run help

# 同步共享模块到 public/lib
cmd /c npm run sync:public-lib

# 运行测试
cmd /c npm test

# 检查版本与发布文档一致性
cmd /c npm run check:release
```

发布前建议执行：

```powershell
cmd /c npm test
cmd /c npm run sync:public-lib -- --check
cmd /c npm run check:release
cmd /c npx --no-install openspec validate --all --strict
git diff --check
```

Windows 桌面与兼容安装包发布还应运行：

```powershell
cmd /c npm run test:desktop-smoke
cmd /c npm run build:desktop
cmd /c npm run build:installer
```

## 版本发布

- 版本号以 `package.json` 和 `package-lock.json` 为准。
- Git tag 使用 `v<version>`，例如 `v0.2.10`。
- Release 标题建议使用 `GPT-Image2-Studio v<version>`。
- Release 应附带变更说明、验证结果、Windows 桌面安装包、免安装 ZIP；如仍分发兼容版，应明确区分三个文件的启动形态。
- 正式发布提交与标签就绪后运行 `npm run check:release:strict`，确认工作树干净且标签与版本一致。
