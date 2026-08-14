## Context

图片详情 Lightbox 已经由 `public/styles.css` 提供桌面双栏、tablet/mobile 堆叠和独立检查器滚动。当前桌面弹窗仍使用接近视口高度的固定 `height`，而图片查看器只根据已有容器尺寸计算缩放，因此横向图片会让媒体区保留不必要的上下空间。结构化提示词渲染器 `lib/asset-workspace.mjs` 会递归展开数组并把数组索引拼进字段路径，导致同一分节被拆成多行。

## Goals / Non-Goals

**Goals:**

- 在已有图片查看器指标同步时，根据已加载图片的自然尺寸和媒体列宽为桌面媒体区计算紧凑高度，并设置视口上限和合理的最小可视高度。
- 保留 tablet、stacked 和 mobile 的现有堆叠布局、独立滚动和触控尺寸。
- 将数组型结构化提示词聚合为共同父路径下的一个检查器字段，使用换行保留每个值的可读边界。
- 让聚合逻辑可在无浏览器 DOM 的单元测试中直接验证，并同步 `lib/` 到 `public/lib/`。

**Non-Goals:**

- 不改变模型返回的 JSON、保存的数据格式、提示词复制原文或参数内容。
- 不重新设计 Lightbox 顶栏、缩放交互、页签或移动端检查器。
- 不为数组值引入新的排序、编辑、折叠或翻译行为。

## Decisions

### Use the existing viewer metrics path for compact desktop height

`createLightboxImageViewer.syncMetrics()` 已在图片加载、窗口 resize 和 `ResizeObserver` 回调中统一刷新自然尺寸与适配缩放。新增紧凑高度同步函数，读取媒体列的实际宽度和图片宽高比，把“图片适配高度 + 媒体内边距”限制在可用视口高度内，并通过 `--lightbox-media-height` 提供给 CSS。桌面基础规则改为 `height: auto`，媒体区使用该变量；tablet/mobile 继续由后置响应式规则接管高度和网格行。

Alternative considered: only add a fixed `aspect-ratio` or a smaller constant height in CSS. That cannot account for portrait, landscape, and ultra-wide source images and would either reintroduce blank space or crop the fitted image.

### Group arrays at their parent field path

`getStructuredPromptFields(value)` 将结构化值转换成 `{ label, value }` 列表。对象继续递归，数组不再递归出数字索引，而是把其可显示内容按换行合并到当前父路径；数组中的嵌套对象保留键名文本，避免丢失语义。DOM 渲染只负责将该列表转成现有 `dl.lightbox-prompt-field` 节点。

Alternative considered: mutate the stored JSON or replace the raw prompt with a flattened string. That would alter copy/export semantics and make the inspector representation the source of truth.

### Keep the canonical/mirrored module contract

The canonical module remains under `lib/asset-workspace.mjs`; `npm run sync:public-lib` updates the browser mirror. Tests cover the canonical pure grouping helper and the existing layout contract continues to verify the mirror is used by the page.

## Risks / Trade-offs

- [A very wide image computes a short media stage] -> Clamp the desktop stage to a compact minimum while preserving `object-fit: contain` and the existing viewer fit calculation.
- [The height update can trigger the existing ResizeObserver] -> Only write the CSS variable when the rounded pixel value changes, so observer callbacks settle after one layout update.
- [Arrays of objects need readable labels] -> Format nested object leaves as `key: value` lines inside the parent field and test this shape explicitly.
- [A constrained layout could inherit the desktop variable] -> Remove the variable when the responsive layout is tablet, stacked, or mobile; the current responsive `height: auto` rules remain authoritative.

## Migration Plan

1. Add the delta spec and focused tests.
2. Implement the viewer height calculation and grouped prompt field conversion, then sync the browser mirror.
3. Run focused tests, public-lib synchronization, full tests, and strict OpenSpec validation.
4. Open the Lightbox on an isolated local port and verify desktop plus narrow viewport geometry and prompt grouping.
5. Rollback is a source-only revert; no persisted data or migration is involved.

## Open Questions

- None.
