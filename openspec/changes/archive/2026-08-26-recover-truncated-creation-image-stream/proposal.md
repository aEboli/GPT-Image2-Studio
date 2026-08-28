## Why

套图生成中途已经看到图，随后图片消失并报 `Unterminated string in JSON at position 2313841`，同时另一条目报"原 Responses 任务结果未知，自动重试后仍未确认，请手动重试"。上一个变更 `chunk-creation-final-image-delivery` 只修了「服务端到浏览器」这一跳的最终图分片和客户端流末容错，「上游到服务端」这一跳以及中途图的归属仍未处理。四处缺陷叠加造成该现象。

**一、服务端上游 SSE 缺少流末截断容错。** `lib/responses-workflow.mjs` 的 `consumeResponsesSse` 在上游流结束时无条件解析残留缓冲：`if (buffer.trim()) { await processChunk(buffer) }`。上游在一行 ~2 MB 的 `partial_image_b64` 中途断开时，`JSON.parse` 抛出原始 `SyntaxError`。该错误从 `consumeResponsesSse` 一路穿出，**回查原任务与一次自动重试的整个阶梯被完全跳过**，直接落入套图路由的 catch，`error.message` 原样写进 `item_failed` 并显示在卡片上。这与客户端 `consumeSse` 已修复的缺陷同源，服务端侧从未修复。复现确认事件序列仅有 `connecting`、`generating`，无 `recovering_original`、无 `retrying_upstream`。

**二、`item_partial_image` 仍在单个 SSE 事件内联整张图。** 套图三条路由与写真两条路由的中途预览都是 `dataUrl: event.dataUrl` 一整行下发，约 2 MB。最终图已分片，中途图未分片，同一类行长截断在中途预览上依然成立；被中间层截断的完整行会让客户端抛出原始解析错误而非中断提示。

**三、已收到的中途图从不被当作兜底。** `consumeResponsesSse` 把预览累积进 `partialImages` 并返回，但全仓库无任何调用方读取该字段。上游确认不了最终图时，一张已经生成并展示过的图被直接丢弃。

**四、失败与补图会整套替换本地 set，抹掉中途预览。** `item_failed` 与 `error` 都携带服务端 manifest，客户端 `upsertCreationSetForStream` 用它整套替换本地 set。manifest 来自 `creationSetStore`，从不含中途预览的 dataUrl，替换瞬间预览被抹掉。`complete` 之后 `runCreationAutoRepairIfNeeded` 触发的自动补图并非重试，卡片重新回到 loading 态，卡片时长显示 `0` 是因为中途预览不带耗时元数据。

**五、底层 HTTP 客户端的默认空闲上限先于应用超时生效（实测确认的主因）。** 对真实上游连续抓取三次，图片到达时间为 `257.8s`、`492.6s`、`190.9s`，同一请求波动极大。事件时序显示上游在 `28.0s` 就发出 `response.image_generation_call.completed`（0.2 KB，不含图），随后**静默 464 秒**，图片才随 `response.output_item.done` 到达（1431.4 KB）。Node 的 `fetch` 即 undici，其 `bodyTimeout` 默认 `300e3`，量的正是相邻 body 数据之间的间隔。全库没有任何 `setGlobalDispatcher` 或 `new Agent`，因此 `CREATION_UPSTREAM_TIMEOUT_MS = 900_000` 从未生效，真实上限是 undici 的 300 秒。静默超限后抛出 `terminated`（`UND_ERR_BODY_TIMEOUT`），该消息命中 `isRetryableStreamReadError`，于是一个仍在正常推进的任务被判为中断，并把回查与自动重试阶梯整套烧掉；重试再起一次全新生成，又是数百秒，再撞一次。这解释了"莫名其妙又进入生成（非重试）"与最终的"自动重试后仍未确认"。

**六、完成信号早于图片交付。** 上游 `image_generation_call.completed` 是"渲染完成"而非"数据已发"，实测该事件在 `28.4s` 到达、图片在 `190.9s` 才到。`consumeResponsesSse` 的正则把它当作完成信号，于是 `complete` 早发 162 秒，客户端计时器在图片到达前就停止——这是卡片"生成时间为 0"的来源。

**另一处实测更正：上游一张中途图都不发。** 三次抓取 `partial images: 0`，且请求体从未携带 `partial_images` 参数（全库零命中）。因此用户中途看到的图不是本条目的中途预览，而是同一套图中其他已完成的条目；后续某条目失败时 manifest 整套替换把它们一起抹掉。缺陷四的现象成立，但成因是已完成条目被覆盖，而非中途预览被丢弃。

## What Changes

- 服务端上游 SSE 消费在流末残留缓冲解析失败时按连接中断处理，保留已收到的 `finalImageBase64` 与 `partialImages` 并走既有回查与自动重试阶梯，不再把 `SyntaxError` 原文透出为用户可见错误；完整事件的解析失败仍按原样抛出。
- 上游确认不了最终结果时，若该任务已收到过中途图，把最后一张中途图作为该条目结果落盘，元数据标记来源为中途预览兜底，卡片与活动记录标注该图未完全渲染；从未收到中途图时保持现有报错与手动重试语义不变。
- 套图三条路由的 `item_partial_image` 改为分片下发，复用既有 48 KB `FINAL_IMAGE_CHUNK_SIZE` 与按 `setId` + `itemId` 的装配键，单事件载荷不超过 48 KB；写真两条路由按范围保持原样。
- 客户端合并服务端 manifest 时保留本地已有预览：manifest 中该条目没有可用图片资产时，不清除本地 `imageUrl` 与 `thumbnailUrl`。自动补图重新进入生成态时同样保留上一轮预览直到新图到达。
- 卡片对中途预览兜底的图给出可见标注，使正式产出中的该类图片可追溯。
- 读取上游图片流时把底层 HTTP 客户端的空闲上限抬到应用自身的上游超时之上，使静默间隔不再由客户端默认值决定，超时判定权归应用；运行环境不支持调整时退回默认行为而非失败。
- 工具级"渲染完成"事件不再单独触发完成信号，仅在已取得图片数据时才视为完成；上游整体响应结束事件仍按终止事件处理。

## Capabilities

### Modified Capabilities

- `creation-mode`: 套图中途预览分片下发、上游截断按中断处理、中途图作为兜底结果落盘并保留预览。

## Impact

- 上游 SSE 截断容错、中途图兜底与完成信号时序：`lib/responses-workflow.mjs`。
- 上游长静默流的 HTTP 客户端空闲上限：新增 `lib/upstream-stream-fetch.mjs`，作为上游图片生成入口的默认 `fetchImpl`。
- 套图中途预览分片下发与兜底落盘元数据：`server.mjs`。
- 客户端分片装配、manifest 合并保留预览、兜底标注：`public/app.js`、`lib/generation-stream-protocol.mjs` 及其 `public/lib` 镜像。
- 回归测试覆盖流末截断改为中断、回查阶梯仍被执行、中途图兜底落盘、中途预览分片下发与装配、manifest 合并不抹预览。
- 不改变提示词模式既有分片与重试行为，不改变写真、文章插图、PPT 当前的中途预览下发方式。
