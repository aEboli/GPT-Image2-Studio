## Why

当前生成日志有三个问题：

1. **失败条目缺少中转 URL。** `recordActivity` 只从 `paramsText` 推导中转地址，而失败路径（`handleActivityFailure`）从不传该字段，所以“图片已生成”带 `URL：https://api.agicto.cn/v1`，“生成失败”却什么都不带，排查失败时看不出走的是哪个中转。
2. **所有板块挤在同一条日志里。** 只有一个全局 `state.activityFeed`（上限 12 条）渲染到配置区的单个列表，提示词生图、风格迁移、图片编辑、快速溶图等板块的条目互相顶掉，看某个板块的日志要在混排里翻找。
3. **套图、写真、文章插图、PPT 完全没有日志。** 这些入口走各自的 SSE 流，从不调用 `recordActivity`，其中套图更是被 `creation-mode` 规范明确要求不写入日志。批量生图恰恰最需要日志，但逐张平铺又会瞬间冲掉其它板块的记录。

## What Changes

- 新增按板块分区（channel）的生成日志存储：`prompt`、`style-transfer`、`image-edit`、`quick-blend`、`image-decomposition`、`reference-analysis`、`creation`、`portrait`、`article-illustration`、`ppt`，每个板块各自保留自己的条目上限，互不挤占。
- 生成日志只保留配置区那一个面板，生图板块内不内嵌日志；面板顶部加板块切换，默认跟随当前所在板块，另有“全部板块”跨板块视图。
- 套图、写真、文章插图、PPT 的生成过程写入各自板块的日志，并**按批次分组**：一个批次一条组行，显示汇总计数（完成/失败/进行中）与中转 URL，**默认折叠**，展开后才列出该批次每张图的明细。
- 单图板块（提示词生图、风格迁移、图片编辑、快速溶图、图片拆解、融图分析）继续按任务逐条显示，不引入分组层级。
- 所有终态与中间态条目统一携带中转 URL：排队、进行中、成功、失败、取消都显示同一种 `URL：<baseUrl>` 文案，失败不再是空白。
- 生成加载动画在百分比下方增加实时进度文本，显示该任务当前的最新状态，超长时换行完整显示而不截断；主预览与套图/写真/文章插图/PPT 卡片显示该行，胶片条与缩略图等小尺寸占位不显示。
- 旧的单一 localStorage 日志记录迁移到 `prompt` 板块，不丢历史、不报错。

## Capabilities

### New Capabilities

- `generation-log`: 按生图板块分区、支持批次分组与统一中转 URL 的生成日志。

### Modified Capabilities

- `generation-loading`: 加载组件在百分比下方增加实时日志行。
- `creation-mode`: 套图生成写入自己的日志板块（按批次分组），而不再是完全不写日志。

## Impact

- 新增共享模块：`lib/generation-log-store.mjs`（分区与分组的纯数据模型）、`lib/generation-log-panel.mjs`（日志行与板块切换渲染），并同步到 `public/lib`。
- 修改共享模块：`lib/generation-activity-feed.mjs`（中转 URL 与条目规范化）、`lib/generation-loading.mjs`（实时日志行）、`lib/creation-card-loading.mjs`（把日志行透传给套图卡片）。
- 前端：`public/app.js` 的活动记录与各 SSE 事件处理、`public/index.html` 配置区日志面板的板块切换容器、`public/styles.css` 的板块切换与加载动画进度文本样式。
- 测试：日志分区与分组模型、中转 URL 一致性、面板渲染与折叠、加载组件日志行、既有静态与布局断言。
