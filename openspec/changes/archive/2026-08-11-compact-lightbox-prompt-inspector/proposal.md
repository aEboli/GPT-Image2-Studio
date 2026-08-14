## Why

图片详情窗口目前按固定的接近全屏高度展开。对于横向图片，媒体区域会在图片上下留下明显空白，检查器中的同一数组字段也会被拆成 `1`、`2`、`3` 等多行，降低复盘效率。

## What Changes

- 让桌面图片详情窗口的媒体区域根据已加载图片的适配高度收紧，同时保留视口上限、缩放查看和检查器独立滚动。
- 将结构化提示词中的数组值按其共同字段路径合并显示，不再在检查器中显示数组索引。
- 保留提示词原文、复制、参数页和非结构化提示词的既有行为。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `lightbox-image-viewer`: 明确图片详情窗口的内容尺寸约束和结构化提示词数组的检查器呈现。

## Impact

- Frontend Lightbox layout in `public/styles.css`.
- Structured prompt renderer in canonical `lib/asset-workspace.mjs` and its browser mirror.
- Focused unit/layout tests and Lightbox OpenSpec specification.
