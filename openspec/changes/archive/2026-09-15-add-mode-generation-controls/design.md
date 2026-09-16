## Context

提示词模式已有思考等级和质量下拉，但其余四个创作页面没有对应控件，客户端请求会直接读取提示词模式的 DOM 值。套图、写真和文章插图服务端已经会归一化请求中的 `quality`；PPT 的请求链路则只从配置默认值读取质量。套图的 `skuBundleCount` 同时存在于当前表单、计划、队列和历史 manifest 中。

## Goals / Non-Goals

**Goals:**

- 每个非提示词创作页面都有自己的思考等级和质量选择，且不会依赖提示词模式的当前选项。
- 每个质量选择都复用现有模型能力判断和归一化逻辑。
- 新套图不再可配置 SKU 组合件数，默认单件 SKU；历史冻结记录保持可修复。
- 每个 `data-tooltip` 控件在运行时只显示一层应用内帮助提示。

**Non-Goals:**

- 不移除服务端、规划器或历史 manifest 中的 `skuBundleCount` 兼容字段。
- 不改变提示词模式的参数、全局默认值或上游路由协议。
- 不为已有历史套图重新规划、迁移或重写图片提示词。

## Decisions

### Per-form controls share renderers, not values

为五个表单保留独立的 `<select>` 元素，并让现有选项渲染函数遍历这些控件。这样每个模式保存自己的当前选择，同时继续使用同一套思考等级、质量选项和模型能力收敛逻辑。把所有页面绑定到提示词模式的一个控件虽然改动较小，但会继续造成跨模式状态泄漏，因此不采用。

### New SKU plans omit the user-controlled count

套图计划请求不再提交 `skuBundleCount`，浏览器队列默认单件 SKU。服务端和修复路径仍接受旧 manifest 的显式件数，避免历史记录重试时改变已冻结的画面和 Listing 事实。彻底删除该字段会破坏历史补图，因此不采用。

### PPT quality travels with all retryable operations

PPT 首次生成、缺页补齐和单页编辑均将质量写入请求或快照；服务端在选定模型后归一化该值，并向每张幻灯片的上游请求和保存元数据传递。仅在首次生成使用质量会让“补齐缺页”悄悄退回默认值，因此不采用。

### Custom tooltip takes precedence over native title

应用绑定或显示 `data-tooltip` 时移除触发器的 `title` 属性，保留 `aria-label` 和 `aria-describedby`。这使键盘与读屏语义保持不变，同时保证浏览器不会在自定义浮层之后再次显示原生提示。

## Risks / Trade-offs

- [切换模型会使某个页面先前选择的扩展质量失效] → 每次重建选项时用既有 `normalizeImageQuality` 收敛到该模型支持的值。
- [历史套图在重新打开时曾尝试回填已删除控件] → 移除该回填，只让历史数据继续走修复和 manifest 路径。
- [PPT 补齐或编辑遗漏质量] → 用同一快照字段覆盖首次生成、补齐与编辑三个请求入口，并做静态请求体测试。
- [动态添加 `title` 的控件又显示双层提示] → 在显示自定义提示时再次删除 `title`，而不是仅依赖初始化清理。

## Migration Plan

1. 部署后，新建套图没有组合件数输入且默认单件 SKU。
2. 既有 manifest 保留其 `skuBundleCount`；补图调用继续以记录中的值为准。
3. 回滚只需恢复前端控件和请求字段；持久化数据无需迁移。

## Open Questions

无。用户已明确要求删除该表单控件并在全部其余创作模式提供参数选择。
