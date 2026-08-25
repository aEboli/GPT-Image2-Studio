## Why

套图把每张成图放进**单个** SSE 事件下发：`item_final_image` 的 `data:` 行携带完整 base64 data URL，1024×1024 PNG 约 1.9～2.0 MB，全部挤在一行里。中间层（反向代理、Electron 壳、隧道）的行长或缓冲上限、以及生成过程中的连接中断，都会把这一行截断。客户端 `consumeSse` 在流结束时无条件解析残留缓冲，于是用户看到的是 `Unterminated string in JSON at position 1952830` 这种 V8 原始报错，既不说明连接断了，也丢掉整张已经生成好的图。

提示词模式早已有解法：`lib/generation-stream-protocol.mjs` 定义了 48 KB 的 `final_image_chunk` 协议，客户端用 `recordFinalImageChunk` 拼装。套图从未接入这套分片协议，而服务端目前也没有任何路由调用 `buildFinalImageChunkPayloads`，该构造函数在服务端已成死代码。

## What Changes

- 套图生成、套图补图、套图 Logo 批量三条路由改为分片下发最终图：新增 `item_final_image_chunk` 事件，单个事件的 base64 载荷不超过 48 KB，复用既有 `FINAL_IMAGE_CHUNK_SIZE` 与分片载荷构造。
- 分片以 `setId` + `itemId` 为装配键，事件携带 `index`、`total`、`mimeType`，客户端集齐后拼成 data URL 再更新卡片预览。
- 保留 `item_final_image` 事件供旧客户端读取语义不变的完成信号，但不再由它携带完整图片数据；套图卡片预览改由分片装配结果驱动。
- 客户端 SSE 消费在流结束时对残留缓冲做容错：解析失败报告连接中断，而不是透出 JSON 语法错误；完整事件的解析失败仍按原样抛出。
- 套图流消费补齐终止事件校验，与 PPT、文章插图、写真模式一致，未收到 `complete`/`error` 时给出明确中断提示。
- 套图分片装配状态在整套流结束后清理，不跨套图残留。

## Capabilities

### Modified Capabilities

- `creation-mode`: 套图最终图改为分片流式下发并明确连接中断行为。

## Impact

- 服务端套图三条 SSE 路由的最终图下发：`server.mjs`。
- 分片协议与装配、SSE 消费容错：`lib/generation-stream-protocol.mjs`、`lib/generation-client.mjs` 及其 `public/lib` 镜像。
- 套图流事件处理与卡片预览装配：`public/app.js`。
- 回归测试覆盖分片下发顺序、装配、截断中断提示和套图端到端；不改变提示词模式既有分片行为，也不改变写真、文章插图当前的下发方式。
