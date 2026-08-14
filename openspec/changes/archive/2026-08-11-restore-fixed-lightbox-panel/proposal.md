# Restore Fixed Lightbox Panel Geometry

## Why

图片详情弹窗当前根据图片自然宽高比重写桌面媒体区高度。横向图片因此会把整个弹窗压成较矮的面板，导致同一详情界面在不同图片之间出现图二、图三那样的尺寸漂移。用户需要所有桌面图片详情保持图一的固定外框。

## What Changes

- 恢复桌面图片详情的固定外框高度与双行布局。
- 让横向、方形和纵向图片都在同一个左侧媒体区内使用适配缩放显示。
- 保留检查器独立滚动、提示词分节聚合以及 tablet、stacked、mobile 的响应式覆盖。
- 移除按图片比例写入 `--lightbox-media-height` 的运行时逻辑。

## Impact

- `lib/lightbox-image-viewer.mjs` 及其 `public/lib/` 镜像。
- `public/styles.css` 桌面 Lightbox 布局规则。
- Lightbox 布局契约测试与 `lightbox-image-viewer` OpenSpec。
