## Context

当前图片详情弹窗由 `public/index.html` 中的 `#lightbox`、`public/styles.css` 中的 `.lightbox-*` 样式和 `public/app.js` 中的 `lightboxItem/lightboxZoomed` 状态驱动。现有实现把图片点击视为二态切换：默认适配视图，点击后隐藏左右详情字段并让 stage 出现滚动区域。这能查看大图，但无法围绕鼠标关注点放大，也缺少连续缩放、平移、百分比反馈和 100% 检查入口。

项目是原生 HTML/CSS/JavaScript 单页结构，测试主要通过 `test/studio-preview-layout.test.mjs` 对 HTML、CSS、JS 源码做结构断言。本次设计需要保持最小必要改动，不引入第三方库，不改变图片生成、保存、下载、删除或画廊元数据流程。

## Goals / Non-Goals

**Goals:**

- 让 lightbox 默认以适配模式打开，并提供接近 PS 的连续缩放和平移体验。
- 支持按钮缩放、滚轮焦点缩放、拖拽平移、适配、100%、双击切换和百分比显示。
- 把查看状态收敛为独立 lightbox viewer 状态，避免污染主预览区 `state.zoom`。
- 在关闭 lightbox、打开新图片或图片源变化时重置 viewer 状态。
- 保留现有下载、删除、复制路径、复制完整路径、复制提示词和 Esc 关闭行为。

**Non-Goals:**

- 不改变主预览区 `#previewImage` 及其现有 `zoomInButton/zoomOutButton/zoomResetButton` 行为。
- 不新增第三方 pan/zoom 依赖。
- 不支持图片编辑、裁剪、标注、像素取样、旋转或对比视图。
- 不改变后端 API、SSE、文件保存、画廊记录或图片下载逻辑。
- 不要求移动端双指缩放作为首批必须能力；移动端至少保持默认适配和基础关闭/下载操作稳定。

## Decisions

### 使用 transform 状态而不是滚动容器改尺寸

采用 `scale + translate` 管理 lightbox 图片位置。viewer 状态包含 `mode`、`scale`、`fitScale`、`x`、`y`、`lastInspectionScale`、拖拽起点和图片自然尺寸。渲染时通过 CSS custom properties 或直接 `style.transform` 更新图片，stage 保持 `overflow: hidden`，避免浏览器滚动条参与查看手感。

备选方案是改变图片 `width/height` 并依赖容器滚动条。这种方案实现较快，但滚轮缩放无法稳定围绕鼠标所在图像点，拖拽体验更像网页滚动，不符合“像 PS 那样”的目标。

### 滚轮缩放围绕光标锚点计算

滚轮事件绑定在 `.lightbox-image-shell` 或 `.lightbox-media-stage` 上，仅 lightbox 打开且存在图片时生效。缩放前把鼠标位置换算到 viewer 坐标系，得到图像锚点；缩放后反推新的 `x/y`，让该锚点仍落在鼠标下方。缩放步进按滚轮方向使用倍率变化，并把结果限制在 `0.25` 到 `8`。

这样用户可以直接把鼠标放在脸部、文字、边缘等位置滚动检查，而不是先放大再拖回目标区域。

### 工具条使用现有 toolbar 样式

在 lightbox 顶部动作区附近增加一组查看控制：缩小、百分比、放大、适配、100%。按钮沿用 `toolbar-button` 风格，新增局部类只处理紧凑排列、禁用态和百分比宽度，避免重新设计整个弹窗。

百分比显示使用当前实际查看比例，适配模式下显示根据容器和图片自然尺寸计算出的 fit 百分比，100% 模式显示 `100%`。

### 拖拽只在可平移时启用

当图片显示尺寸大于可视 stage 或用户已经高于适配比例时，左键按下进入拖拽。拖拽期间阻止默认图片拖动和文本选择，cursor 从 `grab` 变为 `grabbing`。如果图片仍完全适配且无需平移，点击不会进入拖拽，以免影响双击和按钮操作。

### 双击用于快速检查和返回

双击图片或 stage 时，在“适配”和“检查缩放”之间切换：如果当前接近适配，切到 `100%`，或切到用户上次高于适配的检查比例；如果当前已放大，则回到适配。双击时以双击位置作为缩放锚点，减少跳动。

### 图片加载后重新计算适配比例

图片加载完成后读取 `naturalWidth/naturalHeight` 与 stage 可用尺寸计算 `fitScale`。窗口尺寸变化或 lightbox 布局变化时重新计算适配比例：如果当前处于适配模式，立即更新为新的适配值；如果处于检查模式，保留当前检查缩放并夹紧平移边界。

## Risks / Trade-offs

- 滚轮缩放可能与页面滚动冲突 → lightbox 打开时在 viewer 区域调用 `preventDefault()`，并保持 dialog 外层滚动不参与图片查看。
- `public/app.js` 已经很大，新增 viewer 逻辑可能继续增加复杂度 → 把逻辑拆成命名清楚的 helper，例如 `resetLightboxViewer()`, `applyLightboxViewerTransform()`, `zoomLightboxAtPoint()`, `panLightboxBy()`，不做无关重构。
- 源码结构测试无法真实验证手感 → 先用结构测试覆盖关键绑定和状态，实施阶段再用本地浏览器人工验证滚轮、拖拽、双击、关闭和现有操作。
- 图片尚未加载时自然尺寸不可用 → viewer 初始为适配占位状态，`load` 后再计算比例并渲染；失败或空图时禁用查看控制。
- 移动端双指缩放实现成本可能扩大范围 → 首批以桌面完整交互为验收重点，移动端保证布局不破坏、默认适配和按钮可用。
