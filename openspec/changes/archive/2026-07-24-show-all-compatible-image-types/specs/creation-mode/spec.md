## ADDED Requirements

### Requirement: Image-count overrides preserve the compatible image-type catalog

The system SHALL keep every resolved carousel slot for the current platform addressable in `effectivePlan.slots` when a set-level image-count override is lower than the platform's compatible image-type count. The count override SHALL define the default enabled prefix without removing later compatible slots. `effectivePlan.items`, `carouselImageCount`, and actual generation SHALL continue to include only enabled carousel slots.

#### Scenario: 通用电商选择 5 张仍显示完整 18 种类型

- **WHEN** 用户在通用电商平台把套图数量设置为 5
- **THEN** `effectivePlan.slots` 和兼容图片类型区域保留全部 18 个通用电商原生类型
- **AND** 前 5 个默认槽位启用，其余 13 个槽位未启用
- **AND** 兼容图片类型计数显示 `5 / 18`
- **AND** `effectivePlan.items`、`carouselImageCount` 和实际生成只包含 5 个启用轮播项

#### Scenario: 零张与完整数量使用同一类型目录

- **WHEN** 用户把通用电商套图数量设置为 0、1 或 18
- **THEN** 每种数量下兼容图片类型区域都显示相同的 18 个原生类型
- **AND** 启用项数量分别为 0、1 或 18
- **AND** 未启用类型不会进入生成请求

#### Scenario: 用户等量替换兼容图片类型

- **WHEN** 通用电商当前启用 5 个类型，用户取消其中一个并启用第 18 个类型
- **THEN** 第 18 个类型保持可见且可以直接启用
- **AND** 最终 `effectivePlan.items` 和 `carouselImageCount` 仍为 5
- **AND** 实际生成包含新启用类型且不包含被取消类型

#### Scenario: 命名平台目录不扩展为通用 18 项

- **WHEN** 当前命名平台只提供 6 个解析后可用的规范化轮播槽位，且用户选择少于 6 张
- **THEN** 兼容图片类型区域持续显示该平台的 6 个槽位
- **AND** resolver 不增加第 7 至 18 个通用或 `custom` 类型

#### Scenario: 追加生成项不进入兼容类型目录

- **WHEN** 当前计划还包含 SKU 图或信息图重构项
- **THEN** 这些追加项不进入 `effectivePlan.slots` 的兼容轮播目录或其分母
- **AND** 它们继续只计入各自计数与 `totalPlannedItemCount`
