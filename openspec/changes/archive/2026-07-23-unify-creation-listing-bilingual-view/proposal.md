## Why

Creation 套图记录中的 Listing 草稿目前需要在“商品文案 / 搜索优化”和“英文 / 中文 / 对照”之间切换，且宽屏对照将两种语言分到左右两列，不利于按字段连续核对完整内容。需要恢复为单页连续阅读：七个字段一次显示，并让每条英文后紧接对应中文。

## What Changes

- **BREAKING**：移除 Listing 草稿中的“商品文案 / 搜索优化”内容分组切换，按既有固定顺序在同一页面连续显示全部七个字段。
- **BREAKING**：移除“英文 / 中文 / 对照”语言视图切换，不再提供纯英文或纯中文界面。
- 将每个字段和列表条目的双语内容固定为上下对照：英文在上，对应简体中文紧接在下，不因桌面或移动布局改为左右排列。
- 保留英文和中文独立复制、字段级复制、字符数、完整双语复制、JSON 导出、生成入口及历史草稿兼容性。
- 不修改 Listing 生成规则、字段数据、API、持久化或导出结构。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: Creation 套图记录中的 Listing 草稿改为无切换的七字段单页、固定上下双语对照视图。

## Impact

- 共享 Listing 视图：`lib/creation-listing-view.mjs` 及其 `public/lib` 同步副本。
- 浏览器样式：`public/styles.css`。
- 回归测试：Listing 渲染、语言独立复制、固定字段顺序、纵向布局和公共模块同步。
- API、数据模型、Listing 生成、历史记录和导出载荷：无变化。
