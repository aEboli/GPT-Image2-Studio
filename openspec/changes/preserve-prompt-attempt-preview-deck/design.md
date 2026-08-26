## Context

提示词模式的预览链路当前是单值覆盖模型：任务对象上只有一个 `previewUrl`，`partial_image`、`final_image`、`final_image_chunk` 三类事件都往这一个字段上写。这个模型无法表达"同一任务的第二次尝试"，也无法在任务被移除后保留任何图像。

已确认的事实约束：

- 会产生"全新图像"的只有服务端自动重试一次（`lib/responses-workflow.mjs` 的 `maxUnknownResultRetries = 1`）。该重试前会发出 `stage: "retrying_upstream"` 的 status 事件，并经 `server.mjs` 的 `handleGenerationEvent` 透传到浏览器，因此前端有确定信号识别新尝试边界，无需推断。
- `public/lib/generation-client.mjs` 的 `requestRetryCount` 是连接建立前的重连，此时界面尚无图像，不产生卡。
- 因此单个任务的卡上限为 2（尝试 1、尝试 2），与上游重试上限一致。
- `lib/gallery-store.mjs` 的 `normalizeStoredMetadata` 是白名单，未列出的字段会在落盘时被丢弃。
- 本地服务认证集中在 `server.mjs` 的 `routeRequest` 开头，新增路由自动继承认证与来源校验。

## Goals / Non-Goals

Goals:

- 新尝试追加为新卡，不覆盖已有卡。
- 失败尝试若已有中途预览则保留该预览并标记未完成。
- 胶片条槽位数不随卡数增长；展开在槽位内原地完成。
- 未完成预览可显式另存为正式图片。

Non-Goals:

- 不改变上游重试次数或重试判定逻辑。
- 不保留同一尝试的历史中途预览序列（同一尝试内仍只保留最新一张）。
- 不持久化卡组，不引入新的服务端任务状态存储。
- 不改动 Creation、Portrait、PPT、文章插图模式的 `item_partial_image` 行为。

## Decisions

### 卡组数据模型与存放位置

每个卡组为 `{ deckKey, attempts: [...] }`，单个 attempt 为 `{ attemptIndex, previewUrl, kind: "partial" | "final", status: "running" | "completed" | "failed", errorMessage, updatedAt }`。

卡组不放在任务对象内部，而放在独立的会话级映射中，键为预览键。理由：任务失败时 `removeJob` 会把任务从 `state.jobs` 移除，而 `state.jobs` 同时被生成队列并发控制、取消逻辑和运行中占位计数读取；把失败任务留在 `state.jobs` 里会污染这些既有语义。独立映射让卡组的生命周期与任务队列解耦。

任务成功保存后，卡组键从任务预览键改写为画廊预览键（沿用 `replaceImageEditGenerationKey` 等既有改键模式），使成功图片的胶片条槽位仍能展开看到此前失败的尝试。

### 尝试边界的识别

前端在收到 `stage === "retrying_upstream"` 的 status 事件时封存当前尝试并开启新尝试。封存动作：若当前尝试仍是 `running` 且已有 `previewUrl`，置为 `failed` 并保留该预览。这样"图片被换掉"的场景转化为"上一张作为失败尝试卡留下，新图进入新卡"。

不采用比较图像内容或计时推断的方式识别新尝试，因为已有确定的上游信号。

### 失败保留的判定

`error`、流中断未收到终止事件、异常三条路径统一走同一收尾函数：若卡组内存在任何带 `previewUrl` 的尝试，则保留卡组并把未完成尝试标记为 `failed`；若卡组内没有任何图像，则按现状完全清除，不留空卡。失败活动记录同时带上最后一张预览作为缩略图。

### 内存上限

中途预览是 base64 data URL，单张可达数 MB。控制手段：同一尝试内只保留最新一张预览（覆盖写，不追加）；单任务卡数受上游重试上限约束为 2；终态卡组最多保留 6 个，超出时按更新时间移除最早的；全部仅存于内存，不写 localStorage。

### 未完成预览的落盘

新增 `POST /api/prompt-preview/save`，请求体为 JSON，含预览的 base64 数据与生成参数快照。

- 文件名由服务端用既有 `createTimestampedFilename` 生成，不接受客户端传入的路径或文件名，避免路径穿越。
- 图像数据经既有 `decodeAndValidateGeneratedImage` 校验可解码，拒绝非法数据。
- 请求体设独立字节上限（`readJsonBody` 的 `maxBytes`），避免大体积请求打满内存。
- 落盘复用 `saveGeneratedAsset`，因此自动获得画廊索引与元数据 sidecar。
- 元数据新增来源字段并加入 `normalizeStoredMetadata` 白名单，使画廊能区分"未完成预览另存"与正常生成结果。

选择显式接口而非复用 `/api/generate`：另存不产生任何上游调用，不应经过生成流程的配置校验、队列与计费路径。

### 展开交互

角标为真实 `button`，带 `aria-expanded`；展开区为槽位内的兄弟节点，不使用 `aria-hidden` 包裹可聚焦控件（遵循 `workbench-usability-foundation` 既有约束）。未完成卡带可见的未完成标记，其"另存为正式图片"按钮仅在该卡上出现。

## Risks / Trade-offs

- 未完成预览进入画廊后与正常结果混放。缓解：落盘元数据标记来源，且只在用户显式点击另存时发生。
- 胶片条渲染路径增加分支，可能影响既有复用节点逻辑。缓解：卡组为空或单卡时渲染结果与现状一致，回归测试覆盖单卡路径。
- 卡组键改写与既有多处改键逻辑并存，存在遗漏改键导致卡组丢失的风险。缓解：改键集中在保存成功的单一位置。

## Migration Plan

纯增量。无数据迁移：卡组不持久化；新元数据字段缺省为空，旧画廊条目按正常结果处理。前端静态资源版本参数更新以避免旧缓存加载旧渲染逻辑。

## Open Questions

无。
