## Context

`#promptTemplatePopover` 是覆盖视口的非模态层，`.prompt-template-panel` 当前通过 `right` 固定在浏览器右缘。这个边界与主预览中用户实际查看的区域不一致，导致模板面板与预览之间出现无意义的空档。主预览的 `.preview-canvas` 会随工作台网格、窗口尺寸和浏览器缩放变化，因此停靠线必须来自渲染后的 DOM 几何，而不是复制一组静态网格像素。

## Goals / Non-Goals

**Goals:**

- 在 desktop 和 narrow-desktop 布局中，把面板左边缘放到 `#previewCanvas` 的水平中线，并从该边界向右展开。
- 在窗口或视觉视口变化后重新测量锚点，并让面板宽度以锚点为起点计算，保持可见右侧呼吸间距。
- 继续使用 tablet、stacked、mobile 的视口内单列回退规则。
- 不改变模板表单、焦点、关闭、存储或插入行为。

**Non-Goals:**

- 不把面板做成可拖拽、可持久化定位或带遮罩的模态窗口。
- 不调整预览画布尺寸、参数区布局、生成流程或服务端接口。
- 不修复本次任务之外的移动端按钮命中区域问题。

## Decisions

### 用预览画布中线作为运行时停靠线

新增一个轻量几何同步函数，读取 `refs.previewCanvas.getBoundingClientRect()`，将 `rect.left + rect.width / 2` 四舍五入后写入根元素 CSS 变量 `--prompt-template-preview-anchor-left`。该函数在工作台高度同步的两帧流程中执行、在打开 Prompt Kit 前执行一次，并由窗口 resize 与预览画布 `ResizeObserver` 触发，从而覆盖窗口缩放、浏览器缩放、视图切换和网格尺寸变化。

备选方案：继续使用 `--studio-grid-left`、`--studio-grid-gap` 推算位置。该方案只能得到参数列的边界，不能表达截图中主预览的实际可见中线；未来改变预览内边距或列宽时容易再次漂移。

### CSS 从锚点向右展开并保留宽度上限

桌面规则将 `left` 设置为 `var(--prompt-template-preview-anchor-left, 50vw)`，清除 `right` 锚定；宽度使用同一锚点计算到视口右侧的可用空间，最大仍为 680px，并保留 12px 至 26px 的右侧间距。变量尚未完成首次测量时，`50vw` 提供不覆盖参数区的可用回退。

备选方案：给面板设置固定 `left` 像素值。该方案无法适应不同窗口宽度、设备像素比和应用外壳内边距。

### 保留受限布局的显式覆盖

tablet、stacked、mobile 规则继续设置 `left: 10px`、`right: auto`、视口内宽度和单列正文。即使几何同步变量仍存在，级联顺序也会确保受限布局不会继承桌面锚点。

## Risks / Trade-offs

- [中线右侧可用空间不足] -> 使用 `min()` 宽度计算，面板在桌面窄窗口中收缩；进入受限布局后改用全宽内部滚动。
- [预览尚未完成布局时读到零尺寸] -> 保留 `50vw` CSS 回退，并在下一帧和 ResizeObserver 回调中再次测量。
- [重复 ResizeObserver 回调造成布局循环] -> CSS 变量只改变固定面板的位置和可用宽度，不改变预览画布尺寸；观察回调仅调度已有的合帧同步。

## Migration Plan

1. 增加 OpenSpec 增量规格、几何同步逻辑、CSS 定位规则和静态契约测试。
2. 在隔离端口打开模板面板，验证 1280px 桌面、宽桌面和 1024px 受限布局的边界与参数区无重叠。
3. 运行聚焦测试、OpenSpec 严格校验和 `git diff --check`，确认模板交互未变。
4. 归档本变更；回滚只需恢复 `public/app.js`、`public/styles.css` 与测试/规格工件，不涉及数据迁移或服务重启。

## Open Questions

无。
