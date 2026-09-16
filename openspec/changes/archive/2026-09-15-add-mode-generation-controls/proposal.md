## Why

套图、写真、文章插图和 PPT 页面目前没有独立的思考等级和质量选择，部分请求还会错误地复用提示词模式的选择。套图模式中可编辑的 SKU 组合件数也让新计划的 SKU 语义比实际需要更复杂；同时，带自定义提示的数据属性与原生 `title` 同时存在时会造成双层提示。

## What Changes

- 为套图、写真、文章插图和 PPT 页面新增各自的思考等级与质量选择，并将每次选择随相应的计划、生成、补图或编辑请求提交。
- 质量选项按当前生图模型能力重建；不支持的扩展档位自动收敛到支持的质量值。
- 从套图页面移除「SKU 组合件数」控件；新建计划固定为单件 SKU，已保存的冻结计划仍保留其原有件数供查看和补图使用。
- 统一 `data-tooltip` 控件的帮助提示为应用内提示层，避免与浏览器原生 `title` 提示叠加。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `creation-mode`: 套图参数、SKU 新建计划语义与生成请求参数。
- `portrait-mode`: 写真模式的独立生成参数。
- `article-illustration-mode`: 文章插图模式的独立生成参数。
- `ppt-generation`: PPT 页面生成、补齐和编辑的独立生成参数。
- `configuration-usability`: 应用内帮助提示的单一显示通道。

## Impact

- 前端：`public/index.html`、`public/app.js` 和既有表单网格布局。
- 服务端：PPT 生成、缺页补齐与页面编辑的质量参数传递。
- 行为兼容性：旧套图 manifest 的 `skuBundleCount` 不迁移、不重写，仍可用于旧记录的补图。
- 测试：参数控件、请求体、PPT 质量传递和单层悬浮提示的回归检查。
