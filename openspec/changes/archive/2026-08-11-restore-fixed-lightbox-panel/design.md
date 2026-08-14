# Design

## Context

上一轮为消除横向图片上下留白，按图片自然宽高比动态设置 `--lightbox-media-height`，但这同时改变了弹窗外框高度。图一对应的稳定基线是固定桌面外框：弹窗高度为 `min(92dvh, 940px)`，顶栏占据第一行，媒体区占据剩余空间；图片本身通过已有的 fitted viewer 逻辑在左侧媒体列中完整显示。

## Decisions

### Restore the fixed desktop shell

恢复 `.lightbox-dialog` 的固定高度和 `auto minmax(0, 1fr)` 行定义，并让 `.lightbox-media-stage` 使用 `height: auto` 参与第二行的剩余空间分配。这样图片自然比例只影响 `fitScale` 和画布内的留白，不再影响面板外框。

### Keep constrained layouts authoritative

tablet、stacked 和 mobile 继续由后置响应式规则控制媒体区高度、堆叠顺序和检查器滚动。修复只撤销桌面动态变量，不改动这些触控和窄视口约束。

### Remove the dynamic height path entirely

从查看器指标同步流程中删除 `syncCompactStageHeight()` 及其调用，避免 ResizeObserver、图片加载和缩放操作再次改变面板高度。现有 `syncMetrics()` 仍负责图片自然尺寸、适配缩放和拖拽边界。

## Trade-offs

- 横向图片会在固定的左侧媒体区内保留必要的上下适配空间，这是稳定面板几何的预期取舍。
- 极窄桌面视口仍受既有 `max-height` 与响应式布局规则限制，不承诺在所有窗口尺寸下保持图一的绝对像素尺寸。
