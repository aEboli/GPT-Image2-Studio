## Why

Listing 当前提供英文和简体中文对照，缺少德文翻译。用户要求所有 Listing 内容在英文与中文之间增加德文，需覆盖生成、保存、展示、复制和导出全过程。

## What Changes

- 为 Listing 增加与现有字段对应的 `deDisplay` 德文翻译，保留原字段与 `zhDisplay`。
- 所有平台和 Listing 生成入口统一请求真实德文翻译，逐条对应原文，不新增产品事实或改换目标市场。
- 标题、卖点、痛点、五点描述、商品描述、后台搜索词、四组关键词、包装尺寸与重量、产品尺寸与重量统一按英文、德文、中文纵向展示；原本展示的警告和缺失信息也包含德文。
- 德文支持逐条及字段级独立复制、DE 字符统计，并进入复制全部和 JSON 导出。
- 保存、读取、归一化、内容清理及浏览器公共模块同步均保留德文和德文特殊字符。
- 历史草稿没有德文时继续显示已有内容，不自动调用模型、不伪造译文；用户重新生成后补齐三语。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-listing-agent`：生成和保存完整德文翻译。
- `creation-mode`：Listing 展示、复制和导出支持英文、德文、中文对照。

## Impact

- Listing Agent 提示词、数据归一化、内容清理和保存读取链路。
- `lib/creation-listing-view.mjs`、对应 `public/lib` 副本和 Listing 样式。
- Listing 生成、视图、复制、导出和历史兼容回归测试。
- 本提案待用户确认后实现；不改动当前其他未完成工作。
