## Why

当前图片详情弹窗只有点击图片在适配和单一放大态之间切换，查看细节时需要依赖滚动条，无法像 PS 一样围绕关注点连续缩放和拖拽检查。生成图常用于检查脸部、边缘、文字和局部瑕疵，因此 lightbox 需要升级为可控、稳定、不中断现有下载/删除/复制操作的图片查看器。

## What Changes

- 将 lightbox 图片查看从二态点击放大升级为连续缩放和平移查看。
- 在 lightbox 顶部增加查看控制：缩小、当前百分比、放大、适配、100%。
- 支持鼠标滚轮以光标所在图片点为中心缩放，缩放范围限制在 25% 到 800%。
- 支持放大后拖拽平移图片，拖拽期间不触发页面滚动或误点关闭。
- 支持双击在适配视图和 100%/上次检查缩放之间切换。
- 保持 Esc 关闭、下载、删除、复制路径、复制提示词等既有 lightbox 操作不变。
- 切换图片或关闭 lightbox 时重置查看状态，避免上一张图的缩放和平移污染下一张图。

## Capabilities

### New Capabilities

- `lightbox-image-viewer`: 定义图片详情弹窗中的适配、连续缩放、焦点缩放、拖拽平移、快捷复位和查看状态重置行为。

### Modified Capabilities

- None.

## Impact

- Frontend: `public/index.html` 增加 lightbox 查看控制元素；`public/app.js` 增加 viewer 状态、缩放数学、拖拽事件和复位逻辑；`public/styles.css` 调整 lightbox stage、toolbar、cursor 和 transform 相关样式。
- Tests: `test/studio-preview-layout.test.mjs` 更新 lightbox 行为断言，覆盖工具条、状态字段、事件绑定和旧二态点击逻辑移除。
- Dependencies: 不新增第三方库，继续使用原生 HTML/CSS/JavaScript。
- Non-goals: 不改主预览区 `#previewImage` 的现有缩放按钮；不改图片生成、保存、下载、删除或画廊数据结构。
