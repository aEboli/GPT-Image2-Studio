## Why

套图模式已经能为非主体参考图逐张追加信息图重构项，但当前请求仍会混入商品主体图、商品资料、平台策略、目标语言、视觉语言、Logo 和受众转化信息。这些额外上下文会让模型替换商品、重排版式或改写文字，导致结果相对源信息图变化过大。

## What Changes

- 在套图模式中保留“信息图重构”功能开关，新任务默认关闭，用户显式开启或选择 0 张轮播的专用重构模式时启用。
- 在原有 16 种套图角色和 SKU 补图之后，自动为每张非主体参考图追加一个“信息图重构”生成项。
- 将 `product` 和 `reference-product` 视为主体参考；将其余参考图用途视为信息图来源，包括包装、结构细节、尺寸规格、使用说明、使用场景和其他。
- 每个信息图重构请求只附加当前对应的信息图原始文件一张，并使用固定的原样重构提示词；不得附加主体参考图、其他信息图或 Logo，也不得使用最长边 1024 的 JPEG 生成压缩副本。
- 信息图重构提示词不得注入商品资料、平台、类目、营销场景、视觉语言、目标语言、参考分析备注、受众策略或 `conversionIntent`，只允许生成调用继续使用该 item 已冻结的模型、比例、尺寸、质量、格式和推理参数。
- 计划预览、正式生成、队列占位、记录 manifest 和修复流程都保留该开关与追加项。

## Capabilities

### New Capabilities

- `creation-infographic-rebuild`: 覆盖套图模式中从非主体参考图追加 source-only 信息图重构项、固定提示词、请求隔离、记录和修复的行为。

### Modified Capabilities

- `creation-mode`: 为套图级视觉语言、场景、目标语言、参考分析和受众转化提示词增加信息图重构例外。

## Impact

- Affected frontend: `public/index.html`, `public/app.js`, `public/lib/creation-suite-queue.mjs`.
- Affected shared/server modules: `lib/creation-generation-parameters.mjs`, `lib/creation-planner.mjs`, `lib/creation-reference-labels.mjs`, `lib/creation-store.mjs`, `server.mjs`, `cloudflare-pages-worker.mjs`.
- Affected repair path: frozen-plan browser normalization, Local record repair, queued repair, and source-image re-upload binding.
- Affected tests: creation planner, reference labels, queue, store or end-to-end coverage as needed.
- No new runtime dependencies.
