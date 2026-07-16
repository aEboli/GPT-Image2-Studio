## Why

套图模式已经能稳定生成 4 到 16 张电商角色图，但用户上传的参考图里常常混有尺寸图、步骤图、包装清单、场景图等非主体信息图。现在这些信息只能间接影响对应角色，不能一图一图地保留原信息并替换成当前商品主体。

## What Changes

- 在套图模式中新增“信息图重构”功能开关，默认开启，可手动关闭。
- 在原有 16 种套图角色和 SKU 补图之后，自动为每张非主体参考图追加一个“信息图重构”生成项。
- 将 `product` 和 `reference-product` 视为主体参考；将其余参考图用途视为信息图来源，包括包装、结构细节、尺寸规格、使用说明、使用场景和其他。
- 每个信息图重构项使用对应信息图作为版式和信息来源，同时使用主体参考图作为商品主体，要求不改写、不遗漏、不新增原图未提供的信息。
- 计划预览、正式生成、队列占位、记录 manifest 和修复流程都保留该开关与追加项。

## Capabilities

### New Capabilities

- `creation-infographic-rebuild`: 覆盖套图模式中从非主体参考图追加信息图重构项、默认开启开关、主体参考选择、提示词约束、记录和修复的行为。

### Modified Capabilities

- None.

## Impact

- Affected frontend: `public/index.html`, `public/app.js`, `public/lib/creation-suite-queue.mjs`.
- Affected shared/server modules: `lib/creation-planner.mjs`, `lib/creation-reference-labels.mjs`, `lib/creation-store.mjs`, `server.mjs`.
- Affected tests: creation planner, reference labels, queue, store or end-to-end coverage as needed.
- No new runtime dependencies.
