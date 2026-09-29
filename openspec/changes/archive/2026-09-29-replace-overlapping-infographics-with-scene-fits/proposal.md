## Why

通用电商 18 张套图中有多张信息图内容高度重叠：参数规格图与尺寸容量适配图都在做尺寸标注，材质成分解析图、品质工艺证明图与产品细节特写图都在做材质/做工标注。生成结果重复、观感差，而真实使用场景类图片偏少。

## What Changes

- 新增 3 个场景适配角色 `scene-fit-1`、`scene-fit-2`、`scene-fit-3`（场景适配图一/二/三）：每张只表现一个真实使用场景，商品适配该环境、比例真实、少文字。
- 每张场景适配图按商品信息中识别出的场景事实依次分配不同场景；场景事实不足时分别回退到“最常见日常场景 / 出行户外场景 / 季节送礼或特定场合场景”。
- 通用电商 18 个原生槽位中，用上述 3 个角色替换 `spec-table`、`craft-proof`、`material-proof` 三个槽位（位置不变）；浏览器套图角色列表同步替换。
- `spec-table`、`craft-process`、`ingredient-material` 角色保留，京东等命名平台和品类覆盖层仍可使用。

## Capabilities

### Modified Capabilities

- `creation-mode`：通用电商 18 张套图用 3 张场景适配图替换 3 张重叠信息图。

## Impact

- `lib/creation-planner.mjs`、`lib/creation-platform-policies.mjs`、`lib/creation-platform-resolver.mjs`、`lib/creation-reference-labels.mjs` 及其 `public/lib` 镜像。
- `public/app.js` 套图角色预览列表。
- 相关测试：planner、platform policies/planner、browser state、preview layout。
