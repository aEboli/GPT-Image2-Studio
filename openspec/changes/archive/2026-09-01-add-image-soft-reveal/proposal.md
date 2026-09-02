## Why

当前生成结果在图片地址到达后通常直接切换到清晰图。部分主预览虽然已有透明度过渡，但专项预览会在写入 `src` 的同一轮立即标记为可见，缓存图片和异步解码图片都可能跳帧。批量查看时，灯箱切图同样直接替换图片内容，缺少到达感。

参考效果的重点不是扫光、全卡片缩放或新的加载器，而是稳定占位不移动，单张图片在实际可绘制后从轻微模糊、微放大和低透明度聚焦到清晰。

## What Changes

- 新增共享浏览器图片软显现工具：仅在图片 `load` 并完成可用解码后启动显现；同一地址的重复渲染不重播。
- 将工具接入提示词、图片拆解、融图分析、图片编辑和快速溶图的主生成预览。
- 将工具接入图片详情灯箱，使打开图片和在批量结果间切换时拥有相同的显现节奏，同时不改变既有缩放、拖拽或适配计算。
- 在主预览和灯箱中使用约 300ms 的 `opacity`、`filter: blur()` 和独立 `scale` 过渡；不移动容器、不修改加载壳、也不引入扫光或全卡片动画。
- `prefers-reduced-motion: reduce` 下保留正确的图片就绪状态，但取消模糊、缩放和过渡。

## Capabilities

### New Capabilities

- `image-soft-reveal`: 已解码图片在主预览和详情查看器中的统一柔和显现。

### Modified Capabilities

无。

## Impact

- 新增共享模块：`lib/image-reveal.mjs`，并同步至 `public/lib/image-reveal.mjs`。
- 前端入口：`public/app.js`、`lib/views/image-edit-view.mjs`、`lib/views/quick-blend-view.mjs` 与 `public/styles.css`。
- 回归测试：共享模块的状态和延迟解码测试，以及主预览、灯箱和专项生成入口的静态契约测试。
