## Why

套图的分析和营销规划都已有真实流式数据，但面板把阶段状态、摘要和大量逐项细节堆在长页面里；用户很难一眼看出当前处理到了哪里，阅读时也要反复滚动。此次调整让已有事件和已返回内容更容易扫读，同时降低面板与卡片的视觉刺激。

## What Changes

- 将两个面板改为摘要优先、细节按需展开，压缩营销逐图列表并保留完整字段和图片定位操作。
- 以请求实际发出的阶段、耗时、流式接收量和已返回字段构成清楚的进度视图；不伪造百分比、模型思考过程或尚未发生的步骤。
- 统一两个面板的主题表面与卡片层级，降低高亮和背景干扰，保留现有不透明度偏好及可读性。
- 保留面板互斥、窄屏适配、Escape 收起、焦点恢复、滚动位置和现有生成校验行为，不改变服务端接口或生成数据。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`：更新分析和营销面板的进度呈现、信息层级与视觉表面要求。

## Impact

- 前端：`public/app.js`、`lib/creation-marketing-progress-view.mjs`、`lib/text-model-client.mjs`、`public/styles.css`。
- 规范与验证：`openspec/specs/creation-mode/spec.md` 对应增量规范、面板布局和流式预览测试。
- API、模型请求、结果持久化和图片生成流程无变更。
