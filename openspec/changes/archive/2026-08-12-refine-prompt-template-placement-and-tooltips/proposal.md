## Why

提示词模板面板当前锚定在主预览画布中线，离左侧参数区过远，并会在宽屏上占用预览右侧和页面边缘空间。字段提示又由各控件内部的伪元素绘制，受祖先滚动与裁剪层限制，无法保证显示在面板和弹层之上。

## What Changes

- 将 desktop 和 narrow-desktop 的 Prompt Kit 左边缘改为紧贴参数列右侧，并保留现有网格间距，面板从该边界向主预览区域展开且不遮挡参数控件。
- 保留 tablet、stacked 和 mobile 的视口内单列、可滚动回退布局。
- 将应用内 `data-tooltip` 提示统一交给位于浏览器 top layer 的提示浮层呈现，支持鼠标悬浮和键盘焦点，并限制在可视视口内。
- 提示文本遇到中文句号 `。` 或中文分号 `；` 时保留标点，并从下一段开始换行。
- 为提示词模板入口补充与其他图标控件一致的自定义提示；保留既有可访问名称和原生交互。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `creation-mode`: 调整 Prompt Kit 桌面定位边界，并要求提示词模式的操作提示始终显示在应用内容最上层且不被裁剪。

## Impact

- 前端布局与提示浮层：`public/app.js`、`public/index.html`、`public/styles.css`。
- 聚焦布局契约：`test/studio-preview-layout.test.mjs`。
- 不改变服务端 API、模板存储结构、生成请求或模板管理行为。
