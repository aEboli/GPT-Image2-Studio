## Why

AI 营销规划摘要目前作为普通内容插在套图产物区。展开后会增加产物区纵向内容，挤压图片卡片的可见空间；逐图任务虽显示了图片类型，但用户仍要在长列表与图片卡片之间手动查找。

## What Changes

- 将 AI 营销规划摘要改为固定悬浮面板，由现有状态按钮展开或收起，不参与套图产物区和图片网格的尺寸计算。
- 将分析师分析同样改为独立折叠悬浮面板，两个面板互斥展开；支持标题区收起和 Escape 关闭并恢复焦点。
- 收紧摘要、时间线与逐图任务的排版；窄屏采用单列任务布局并限制悬浮面板高度。
- 逐图任务显示对应图片类型，点击后定位到同一任务 ID 的图片卡片；对校验移除或未返回任务，按原始序号定位到对应缺失占位卡片，并在定位后短暂高亮。
- 保持既有规划阶段、计时、来源摘要和提示词校验行为。

## Capabilities

### Modified Capabilities

- `creation-mode`: 定义 AI 营销规划悬浮面板布局、任务到图片卡片的定位行为及缺失项映射。

## Impact

- 视图：`lib/creation-marketing-progress-view.mjs` 及 `public/lib` 镜像。
- 套图界面：`public/app.js`、`public/index.html`、`public/styles.css`。
- 进度视图数据：`lib/creation-marketing-progress.mjs` 及 `public/lib` 镜像，保留逐图任务 ID 与原始序号。
- 测试：营销进度与缺失图片卡片交互。
