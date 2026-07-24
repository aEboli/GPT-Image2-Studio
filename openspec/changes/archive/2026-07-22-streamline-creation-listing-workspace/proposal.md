## Why

Creation 记录中的 Listing 草稿将七个字段和中英文内容全部同时展开，导致页面过长、扫读困难，复制目标与正文的视觉层级也不清晰。需要在保留旧版双语 Listing 与复制契约的前提下，把高频阅读、对照和导出操作组织成更紧凑的工作区。

## What Changes

- 为 Listing 草稿增加 `英文 / 中文 / 对照` 视图切换，默认显示英文发布文案；对照模式在宽屏双列、窄屏上下排列。
- 将七个固定字段分为 `商品文案` 与 `搜索优化` 两个视图，减少一次展开的内容量，同时保持字段数据与固定顺序不变。
- 将生成、完整双语复制和 JSON 导出收拢到可在 Listing 区域滚动时持续可见的紧凑操作栏。
- 去除重复标题和字段嵌套卡片，将复制操作与字符数降为次级控件，但继续支持字段级、条目级的中英文独立复制。
- 保持 Listing 生成规则、JSON 结构、持久化、API、历史草稿与完整双语复制/导出语义不变。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: Creation 记录中的 Listing 草稿支持语言视图、内容分组和滚动可达操作栏，同时保留固定七字段与既有双语复制契约。

## Impact

- 浏览器 UI：`public/index.html`、`public/styles.css`、`public/app.js`。
- 共享 Listing 视图：`lib/creation-listing-view.mjs` 及其 `public/lib` 同步副本。
- 测试：Listing 渲染、视图切换、复制事件、响应式布局和公共模块同步回归。
- API、数据模型、Listing 生成与历史记录：无变化。
