## Context

生成日志现状：

- `lib/generation-activity-feed.mjs` 提供纯函数：`upsertGenerationActivityEntry`（按 `key` 去重、按 `orderAt` 倒序、截断到 12 条）、`buildGenerationTaskStatusText`（阶段前缀）、`getGenerationActivityDisplayText`（拆成 summary/detail）、`sanitizeGenerationActivityDetail`（剥掉提示词尾巴）。
- `public/app.js` 持有唯一的 `state.activityFeed`，落在 localStorage `image-studio-generation-activity-v1`，由 `recordActivity()` 写入，`renderTimeline()` 渲染到配置抽屉的 `#timelineList`。
- 中转 URL 由 `buildGenerationActivityRelayText(item)` 从已保存条目推导，再由 `getGenerationActivityRelayText()` 归一化成 `URL：…`。`recordActivity` 的 `paramsText` 只在成功路径（`handleActivitySuccess`）和轮询回填（`recordGenerationTaskActivity`，且要求 `task.item` 存在）传入。
- 走 `state.jobs` 队列的板块（提示词生图、风格迁移、图片编辑、快速溶图、图片拆解、融图分析）通过 `handleActivity*` 系列写日志；套图、写真、文章插图、PPT 走独立 SSE（`handleCreationStreamEvent` 等），完全不写日志。
- `lib/generation-loading.mjs` 的 shell 只有 `.generation-loading-drop`、`.generation-loading-percent`、`.generation-loading-label` 三个可见节点。

## Goals / Non-Goals

Goals:

- 日志按板块分区，单板块的洗刷不影响其它板块。
- 批量生图（套图/写真/文章插图/PPT）进入日志但不淹没日志：一个批次一条可折叠组行。
- 任何状态的日志条目都能看出走的是哪个中转地址。
- 加载动画能就地看到当前状态，不必打开日志面板。

Non-Goals:

- 不改生成协议、SSE 事件名、重试与兜底逻辑。
- 不改百分比时序、`99%` 上限、等待态语义与阶段配色。
- 不做日志导出、搜索、跨会话服务端持久化。
- 不改画廊与记录页的历史数据结构。

## Decisions

### 1. 分区模型放在新的纯模块，而不是塞进现有 feed 模块

新增 `lib/generation-log-store.mjs`，只做数据：channel 归一化、条目/分组 upsert、每 channel 独立裁剪、分组汇总计数、序列化与旧格式迁移。`generation-activity-feed.mjs` 保持它现在的职责（文案与单条规范化）并被新模块复用。

理由：现有 feed 模块已经承担文案推导，再加分区+分组会让它同时管数据形状和展示文案；拆开后两边都能单测，而且渲染层可以只依赖 store 的输出。

### 2. Channel 由板块推导，单图板块不分组、批量板块按批次分组

Channel 取值固定为板块 id：`prompt`、`style-transfer`、`image-edit`、`quick-blend`、`image-decomposition`、`reference-analysis`、`creation`、`portrait`、`article-illustration`、`ppt`。

- 单图板块：条目就是任务本身，`groupId` 为空，渲染为平铺行。
- 批量板块：`groupId` 取批次标识（套图 `setId`、写真 setId、文章插图 setId、PPT deckId），批次内每张图是子条目 `groupItemId`（`itemId` / slide id）。组行状态由子条目汇总：有进行中→`active`，全部完成→`done`，有失败且无进行中→`error`。

理由：单图板块加一层分组只会多一次点击；批量板块不分组就会用几十条把 12 条上限瞬间冲掉。

### 3. 每 channel 独立上限，组行与子条目分别计数

每个 channel 保留最多 12 条顶层行（平铺条目或组行），每个组行保留最多 24 条子条目。超出时丢最旧的。

理由：一个 16 张的套图批次 + 一次补齐仍在单组内，不会因为子条目多而挤掉别的批次；顶层 12 与现状一致，用户对面板高度的预期不变。

### 4. 中转 URL 在入队时就落到条目上

把中转地址的推导从"只在拿到 `item` 后"改成"入队时按当前板块的路由配置解析一次"，写入条目的 `relayUrl`，后续状态更新沿用已有值（除非拿到更精确的 `item.baseUrl`）。渲染时统一输出 `URL：<relayUrl>`。

理由：失败路径本来就拿不到 `item`，只有在入队时留存才能让失败条目也有 URL。这也顺带修掉"排队中/进行中"条目缺 URL 的同一个根因。

### 5. 日志只有配置区一处，分区靠面板顶部的板块切换体现

新增 `lib/generation-log-panel.mjs`，导出 `renderGenerationLogRows(list, { entries, channel, expandedGroupIds, ... })` 负责组行、子条目、折叠按钮与空态，另导出 `renderGenerationLogChannelTabs(host, { channels, activeChannel, ... })` 负责板块切换。

- `channel` 为具体板块：只渲染该分区条目，不逐行重复板块标签。
- `channel` 为 `all`：渲染全部分区条目并在每行显示板块标签。
- 默认 channel 跟随当前所在板块（`state.generationLogChannel` 为空串时按 `state.activeView` 推导，studio 再细分 prompt/style-transfer）；用户点过切换后以那次显式选择为准。
- 切换项只列出有条目的板块，外加当前板块本身，这样刚进入的空板块也能看到自己的空态。

理由：用户要求日志只存在于配置区那一个位置，所以"每板块独立"必须在这一个面板内解决，而不是把面板复制到十个产物区。滚动锚定与未读逻辑仍留在 `app.js`，组件只负责列表内容与标签排。

### 6. 折叠状态存在内存里，不持久化

`expandedGroupIds` 放在 `state`，刷新后回到默认折叠。

理由：用户选择了"默认折叠"，持久化展开态会让下次进来又是一屏明细，与该选择相悖；同时避免再加一个 localStorage 键。

### 7. 加载动画的日志行是可选节点，由调用点显式开启

`createGenerationLoadingShell` 增加 `.generation-loading-log` 节点，`updateGenerationLoadingShell({ logText })` 更新；节点只有在 `showLog` 为真且 `logText` 非空时可见。主预览与套图/写真/文章插图/PPT 卡片传 `showLog: true`，胶片条与缩略图不传。文本换行完整显示，不截断也不加省略号。

理由：小尺寸占位放不下文本，硬塞会挤压百分比。opt-in 让"哪些动画显示进度文本"是调用点的显式决定，而不是靠 CSS 尺寸猜。完整换行是用户明确要求：截断会把"上游重试 1/2"这类关键尾部信息吃掉。代价是长文案会把卡片高度顶高一点，这一点让位于可读性。

### 8. localStorage 迁移

键升到 `image-studio-generation-activity-v2`，结构为 `{ version: 2, channels: { <channel>: entries[] } }`。读到 v1 的数组时整体归入 `prompt` channel；读到损坏内容时按空日志起步，不抛错。

理由：v1 里的条目全部来自走 `state.jobs` 的板块，绝大多数是提示词生图；归到 `prompt` 是无损且不需要猜测的处理。

## Risks / Trade-offs

- **十个板块都要挂载面板，改动面宽。** 用同一个共享组件 + 每个板块一个挂载容器把每处改动压到一个容器加一次渲染调用；板块自身的布局不动。
- **批量板块的日志写入点分散在各自的 SSE 处理里。** 为每个批量板块提供一个薄的记录函数（`recordCreationLogEvent` 等），SSE 处理里只调用它，避免在事件分支里重复拼条目。
- **组行汇总在补齐/重试后可能与卡片状态短暂不一致。** 汇总只从子条目实时推导，不缓存计数，重渲染即一致。
- **默认折叠会让用户少看到一层信息。** 组行本身带完成/失败/进行中计数与 URL，失败数不为 0 时组行显示为失败态，不展开也能发现问题。

## Migration Plan

1. 落地 store 与面板组件（纯模块 + 单测），不接线。
2. 接线单图板块：`recordActivity` 带上 channel 与 `relayUrl`，抽屉面板切换到新 store，行为与现状等价。
3. 配置区日志面板加板块切换，默认跟随当前板块。
4. 接线批量板块的分组写入。
5. 加载组件日志行 + 调用点 opt-in。
6. 同步 `public/lib`，跑全量测试与浏览器/桌面冒烟。

## Open Questions

无。
