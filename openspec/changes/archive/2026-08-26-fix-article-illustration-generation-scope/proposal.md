## Why

`handleArticleIllustrationGenerate` 里被整段复制进了一份属于提示词模式的局部蒙版生成代码（`server.mjs:2876-2966`），文章插图本身没有蒙版编辑能力，这段代码不属于该处理函数。

该块引用了八个在函数作用域与模块作用域都不存在的名字：`isLocalMaskImageEdit`、`executionStrategy`、`regionInstructions`、`localMasks`、`isImageEdit`、`localMask`、`styleTransferStylePreset`、`quickBlendReferenceGroups`。

但更早触发的是一处时序死区：`server.mjs:2886` 在构造 `sharedGenerationOptions` 时读取 `generationResult.endpointPath`，而 `let generationResult` 在下一行 `server.mjs:2890` 才声明，两者位于同一个 `try` 作用域。同构最小样例实测为：

```
ReferenceError: Cannot access 'generationResult' before initialization
```

该错误落在逐条目的 catch（`server.mjs:3049`）里，所以表现不是服务崩溃，而是每个条目都发出 `item_failed`、消息为这句 ReferenceError 原文，整套文章插图全部失败。`/api/article-illustration/generate` 与 `/api/article-illustration/generate-references` 目前没有任何测试覆盖，现有三个文件只覆盖 planner、store 与 layout，因此该缺陷未被拦住。

受影响的既有规范要求是 `article-illustration-mode` 的「Reference cards support consistency」：它要求服务端把已完成的参考卡图作为 `referenceImages` 传给生图请求，而按当前代码这一行为在运行时不可达。

## What Changes

- 删除 `handleArticleIllustrationGenerate` 中误植的局部蒙版分支与其顺序执行循环，只保留文章插图真正需要的那一次生图调用。
- `sharedGenerationOptions.endpointPath` 改回读取 `generationConfig.endpointPath`，消除对尚未声明的 `generationResult` 的引用。
- 该调用不再传 `sourceImage`、`mask`，`referenceImageLabels` 不再经由风格迁移标签函数计算；文章插图的参考图仍按现有 `getArticleReferenceImagesForItem` 结果传入。
- 为 `/api/article-illustration/generate` 与 `/api/article-illustration/generate-references` 补端到端回归测试：正常出图并落盘、参考卡图作为 `referenceImages` 送达上游、不再出现 ReferenceError 文案的 `item_failed`。

## Capabilities

### Modified Capabilities

- `article-illustration-mode`: 文章插图生图请求只走单次无蒙版调用，并具备端到端回归覆盖。

## Out of Scope

校验过程中发现的既有缺陷，不在本次修复范围：`articleSetId` 与 `articleItemId` 未列入
`lib/gallery-store.mjs` 的落盘元数据白名单（该处只有 `creationSetId` 与 `creationItemId`），
因此文章插图的图片元数据 JSON 丢失套图与条目归属字段。本次仅按 `assetKind` 断言落盘结果，
归属字段的修复另开变更处理。

## Impact

- 生图调用与共享选项构造：`server.mjs`（`handleArticleIllustrationGenerate`）。
- 新增测试：`test/article-illustration-server.test.mjs`。
- 不改动提示词模式的局部蒙版能力（其正本在 `handleGenerate`，`server.mjs:6156-6230`）。
- 不改动 `requestStudioImageGeneration` 的通道分发，也不改动套图、写真、PPT 的任何行为。
