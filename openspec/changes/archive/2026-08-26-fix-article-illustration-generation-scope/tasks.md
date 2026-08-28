## 1. Specification

- [x] 1.1 添加提案与 `article-illustration-mode` 增量规范。
- [x] 1.2 用严格模式校验该变更。

## 2. 复现

- [x] 2.1 新增 `test/article-illustration-server.test.mjs`，对 `/api/article-illustration/generate`
      发起真实请求并断言不出现 `ReferenceError` 文案的 `item_failed`；确认该测试在修复前失败。
  - 修复前实测：两个条目都 `item_failed`，`message` 为
    `Cannot access 'generationResult' before initialization`，套图 `status` 落为 `failed`。

## 3. 修复生图调用作用域

- [x] 3.1 删除 `handleArticleIllustrationGenerate` 中误植的局部蒙版分支及其顺序执行循环，
      只保留单次生图调用。
- [x] 3.2 `sharedGenerationOptions` 整体移除，改为在调用处直接读取 `generationConfig.endpointPath`，
      消除对尚未声明的 `generationResult` 的时序死区引用。
- [x] 3.3 该调用移除 `sourceImage`、`mask`，`referenceImageLabels` 取空数组，
      不再调用 `getStyleTransferReferenceImageLabels`。
- [x] 3.4 修正 `handleGenerationEvent` 因原复制粘贴导致的缩进，与所在作用域对齐。
  - 复核 `server.mjs:2646-3075` 内已无 `isLocalMaskImageEdit`、`executionStrategy`、
    `regionInstructions`、`localMasks`、`isImageEdit`、`localMask`、`styleTransferStylePreset`、
    `quickBlendReferenceGroups`、`sharedGenerationOptions`、`generationMode` 残留引用。
  - `buildLocalMaskRegionPrompt` 仍被提示词模式正本使用，未变为孤儿。

## 4. 验证

- [x] 4.1 补齐 `/api/article-illustration/generate-references` 的端到端测试，断言只针对参考卡条目、
      条目完成并落盘。
- [x] 4.2 运行新增测试与文章插图既有测试：`article-illustration-server` 2/2，
      与 `image-edit-server`、`image-edit-local-mask`、`article-illustration-{planner,store,layout}`
      合计 45/45。
- [x] 4.3 运行完整测试套件：`1718/1718`，提示词模式局部蒙版、套图、写真、PPT 无回归。
      `sync-public-lib --check` 97 个模块通过。
- [x] 4.4 严格校验该变更并归档。

## 5. 范围外记录

- [x] 5.1 记录校验中发现但不属本次范围的既有缺陷（见提案「Out of Scope」）。
