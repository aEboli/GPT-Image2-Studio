## Why

当前 SKU 参考图分析只提取每个完整产品单位的单一主导色，并主动忽略各款共有的黑色、灰色等中性部件色。对于棕色外观、黑色带子、银色镜片这类多部件商品，主体下方最终只显示部分颜色，无法准确概括买家可见的 SKU 外观。

## What Changes

- 将每个完整产品单位的颜色结果定义为一个完整的“特征颜色标签”，覆盖主体上清楚可见且有助于区分外观的关键部件色。
- 允许单个标签同时包含多个颜色，并在仅靠颜色词会产生歧义时保留简短部件名，例如 `brown, black, silver lenses`。
- 保持多产品单位场景中“一单位一标签”的顺序和边界，避免把单个主体的多个特征色误判为多个 SKU 单位。
- 颜色证据不足时继续不猜测；背景、阴影、高光、反射和主体外文字继续排除。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`: SKU 参考分析和生成提示改为在主体下方呈现完整的关键部件特征颜色，而不再只呈现单一主导色。

## Impact

- 视觉分析提示及其严格 JSON schema：`lib/prompt-agent.mjs`
- SKU 颜色字段的服务端规划、浏览器载荷归一化及公共镜像：`lib/creation-planner.mjs`、`lib/creation-sku-subjects.mjs`、`public/lib/creation-sku-subjects.mjs`
- SKU 颜色相关回归测试与 Creation Mode 行为规格
- 不新增依赖，不改变现有 SKU 数量、参考图分组或旧 `colorName` 载荷的兼容性
