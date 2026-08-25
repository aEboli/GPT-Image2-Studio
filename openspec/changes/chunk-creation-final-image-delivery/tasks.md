## 1. 规格与失败基线

- [x] 1.1 明确套图分片下发契约：48 KB 上限、`setId`/`itemId`/`index`/`total`/`mimeType` 字段和按条目独立装配边界。
- [x] 1.2 增加失败基线测试：截断流报告连接中断而非 JSON 语法错误，完整事件的解析失败仍按原样抛出。
  - `test/generation-client.test.mjs` 复现原始报错 `Unterminated string in JSON at position ...` 并断言改为连接中断提示，同时保留完整事件的 `SyntaxError`。
- [x] 1.3 增加失败基线测试：套图三条路由分片下发最终图，且单事件载荷不超过 48 KB。
  - `test/creation-e2e-regression.test.mjs` 断言分片事件携带装配字段、不内联 `dataUrl`，并把线上载荷喂回共享装配器还原出可解码 PNG。

## 2. 协议与服务端实现

- [x] 2.1 扩展分片载荷构造支持按条目装配键，保持提示词模式既有 `filename` 键行为不变。
  - 新增 `buildFinalImageChunkKey`；`setId`+`itemId` 合成 `set::item` 键，未提供时回落到 `filename`，提示词模式载荷形状不变。
- [x] 2.2 让套图生成、套图补图、套图 Logo 批量三条路由改为分片下发最终图。
  - 新增 `writeCreationItemFinalImage` 统一下发；`item_final_image` 保留为不含图片数据的完成事件。写真两条路由按范围保持原样。
- [x] 2.3 `consumeSse` 对流末残留缓冲做容错，解析失败报告连接中断。
- [x] 2.4 套图流补齐终止事件校验，与其他模式对齐。

## 3. 客户端装配

- [x] 3.1 套图流事件处理按条目装配分片，集齐后更新卡片预览。
  - 装配状态挂在每条流的 context 上，并发条目互不干扰；旧服务端内联 `dataUrl` 仍可用。
- [x] 3.2 整套流结束后清理装配状态，不跨套图残留。
  - 新增 `clearFinalImageChunks`，`runCreationStream` 在 `finally` 中清理。

## 4. 验证与交付

- [x] 4.1 运行分片协议、SSE 消费、套图服务端和套图端到端聚焦测试。
  - `generation-stream-protocol` 9/9、`generation-client` 4/4、套图端到端工作流用例通过。
- [x] 4.2 运行 `node scripts/sync-public-lib.mjs --check`、`git diff --check`、Node 语法检查和完整 `npm test`。
  - 同步检查 95 个模块通过；`git diff --check` 干净；7 个改动文件 `node --check` 全部通过；完整测试 `1627/1628`。
  - 唯一失败 `generation thumbnail renderers use the shared loading status label` 为工作区既有 quick-blend 改动遗留：`lib/views/quick-blend-view.mjs` 及其镜像均缺少 `formatLoadingThumbnailStatusLabel`，把本次改动 stash 后该用例同样失败，与本 change 无关。
- [x] 4.3 运行当前 change 的 OpenSpec 严格校验。
  - `openspec validate chunk-creation-final-image-delivery --strict` 通过；全项目 `32 passed, 2 failed`，两个失败为既有未归档 change `add-product-image-collector`、`retry-unknown-responses-once`，本次未触碰。
