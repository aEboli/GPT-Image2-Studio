# Lightbox 图片查看器设计

## 来源

- 用户确认方案：采用 `transform + viewer 状态` 的完整交互方案。
- OpenSpec 事实来源：`openspec/changes/enhance-lightbox-image-viewer/`。
- 本文件仅记录 Brainstorming 阶段确认的设计，不作为第二套实施计划维护。

## 目标

将图片详情弹窗从“点击后二态放大”升级为接近 PS 的查看体验：默认适配、连续缩放、鼠标点位缩放、拖拽平移、工具条百分比、适配、100%、双击切换和 Esc 关闭。

## 设计决策

使用 lightbox 专属 viewer 状态管理 `scale + translate`，不复用主预览区 `state.zoom`。图片在 clipped viewport 内通过 transform 移动和缩放，滚轮缩放围绕鼠标所在图片点计算，拖拽平移只在图片大于可视区域时启用。

不采用滚动容器改图片尺寸，因为它更像网页大图浏览，焦点缩放和平移手感都不够像 PS。不引入第三方 panzoom 库，因为当前项目是原生单页结构，这个局部功能不值得增加依赖。

## 验收重点

- 打开或切换图片时始终回到适配视图。
- 滚轮缩放不会带动页面或弹窗滚动。
- 放大后可以拖拽平移，释放后保持位置。
- 双击可在适配和 100%/上次检查比例之间切换。
- 下载、删除、复制提示词、复制路径、关闭和 Esc 行为保持不变。
- 桌面优先完成完整交互，移动端至少保持布局和基础操作稳定。

## 后续

实施前请以 OpenSpec change 为准：

- `openspec/changes/enhance-lightbox-image-viewer/proposal.md`
- `openspec/changes/enhance-lightbox-image-viewer/design.md`
- `openspec/changes/enhance-lightbox-image-viewer/specs/lightbox-image-viewer/spec.md`
- `openspec/changes/enhance-lightbox-image-viewer/tasks.md`
