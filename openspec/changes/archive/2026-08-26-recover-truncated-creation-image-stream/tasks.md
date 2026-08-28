## 1. 失败基线

- [x] 1.1 上游流末截断的失败基线：`test/responses-workflow.test.mjs` 断言截断尾部不再抛 `Unterminated string in JSON`，且 `recovering_original` 与 `retrying_upstream` 阶梯仍被执行。
  - 复现确认原始报错：修复前事件序列仅 `connecting`、`generating`，回查阶梯被完全跳过。
- [x] 1.2 完整但非法事件的回归基线：解析失败仍按原样抛出，不被中断提示替换。
- [x] 1.3 中途图兜底的失败基线：回查与自动重试均未确认且已有中途图时返回该中途图并标记兜底来源；从未收到中途图时保持现有报错。
- [x] 1.4 套图中途预览分片下发的失败基线：断言 `item_partial_image` 不再内联 `dataUrl`，分片事件载荷不超过 48 KB 且带装配字段。
  - `test/generation-stream-protocol.test.mjs` 以「凡是分片下发最终图的路由，必须分片下发中途预览」为不变量，按函数体结构断言，不依赖行号。
- [x] 1.5 manifest 合并保留预览的失败基线：清单缺该条目图片资产时不清除本地预览。

## 2. 服务端与工作流实现

- [x] 2.1 `consumeResponsesSse` 流末残留缓冲解析失败按连接中断处理，保留 `finalImageBase64` 与 `partialImages` 并返回 `streamInterrupted`。
  - 截断前已收到最终图时按成功返回，尾部截断视为无害噪声。
- [x] 2.2 上游结果无法确认且已有中途图时，把最后一张中途图作为结果返回，携带兜底来源标记。
  - 中途图跨自动重试传递：重试没产出时不丢弃首次尝试的预览。上游明确 `failed` 时不兜底。
- [x] 2.3 套图三条路由的 `item_partial_image` 改为分片下发，复用 `FINAL_IMAGE_CHUNK_SIZE` 与按条目装配键。
  - 新增 `createCreationItemPartialImageWriter`，按条目维护 `sequence`。写真两条路由按范围保持原样。
- [x] 2.4 兜底落盘的元数据标记来源为中途预览兜底。

## 3. 客户端实现

- [x] 3.1 套图中途预览分片装配，新预览整体替换旧预览，不完整分片不展示。
  - 新增 `recordPartialImageChunk` 与独立装配 store；`sequence` 更高的预览丢弃半成品，落后的残片被忽略。
- [x] 3.2 manifest 合并保留本地预览；自动补图保留上一轮预览直到新图到达。
  - 新增 `lib/creation-preview-retention.mjs`，在 `upsertCreationSetForStream` 合并；已落盘资产优先。
- [x] 3.3 卡片与活动记录标注中途预览兜底的图未完全渲染。
  - 卡片状态标签追加「（中途预览，未完全渲染）」与「（保留中途预览）」；两个标记加入条目归一化白名单。

## 3.5 上游静默间隔与完成信号时序

- [x] 3.5.1 失败基线：长于客户端默认空闲上限的静默间隔会掐断流；改用长空闲上限的 fetch 后同一间隔可正常读完。
  - `test/upstream-stream-fetch.test.mjs` 用一个先发头再静默的本地服务复现 `UND_ERR_BODY_TIMEOUT`。
- [x] 3.5.2 上游图片生成入口默认使用长空闲上限的 fetch，空闲上限高于 `CREATION_UPSTREAM_TIMEOUT_MS`，超时判定权归应用。
  - 新增 `lib/upstream-stream-fetch.mjs`；从 Node 内置 undici 的全局 dispatcher 取 `Agent` 构造器，避免 import 仅存在于 devDependency 的 `undici`（Vercel `--omit=dev`）。
- [x] 3.5.3 无法取得或构造 dispatcher 时退回普通 fetch，不使请求失败。
- [x] 3.5.4 工具级完成事件仅在已取得图片时才触发完成信号；`response.completed` 保持无条件终止语义。
  - 失败基线钉住实测时序：`final_image` 必须早于 `complete`。

## 4. 验证与交付

- [x] 4.1 运行上游流、套图服务端、分片协议与套图端到端聚焦测试。
  - `responses-workflow` 75/75、`generation-stream-protocol` 15/15、`creation-preview-retention` 7/7、`creation-fallback-provenance` 7/7，合计 104/104。
- [x] 4.2 运行 `node scripts/sync-public-lib.mjs --check`、`git diff --check`、改动文件 `node --check` 与完整 `npm test`。
  - 同步检查 97 个模块通过（新模块已加入同步清单）；`git diff --check` 干净；19 个改动文件 `node --check` 全部通过；完整测试 `1703/1703`。
- [x] 4.3 运行 `openspec validate recover-truncated-creation-image-stream --strict`。
- [x] 4.4 运行 `openspec validate --all --strict`：38 项全通过。
