## Why

实际生成的 18 张套图中，适用多场景图、冲动下单氛围图、真人手持、真人穿戴和 3 张场景适配图共 7 张几乎相同：它们都附带同一张场景参考图，其中 4 张还被要求"忠实重建"该图的人物、动作和机位，场景适配图在缺少场景事实时也都落到同一个场景。另外，未填写卖点时英文提示词会带入中文占位语。

## What Changes

- 只有 `scene` 角色把场景参考图当作视觉蓝本忠实重建；其他角色只沿用环境与活动类型，并要求新的人物、姿态、机位和瞬间。
- 场景适配图不再附带场景参考图，只附带商品主体。
- 3 张场景适配图分别使用不同镜头：无人物的商品环境静物、仅手部的动作特写、不同时间/天气/季节的远景。
- 未填写卖点时不再输出中文占位卖点。

## Capabilities

### Modified Capabilities

- `creation-mode`：场景类图片差异化。

## Impact

- `lib/creation-planner.mjs`、`lib/creation-reference-labels.mjs`；测试 `test/creation-platform-planner.test.mjs`、`test/creation-reference-labels.test.mjs`。
