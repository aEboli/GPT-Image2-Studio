## Context

当前 UI 使用纯 HTML/CSS/JavaScript 和本地/Cloudflare 共享的 `lib` 模块。大型工作流集中在 `public/app.js`，静态布局在 `public/index.html`，布局护栏主要由 `test/studio-preview-layout.test.mjs` 通过源码断言覆盖。

本次设计遵循最小改动原则：先修正语义错误和公告缺失，不重构大文件，不改变工作流数据模型。

## Design

### Accessible Hidden-State Cleanup

顶部旧版 ghost actions 在桌面上通过 CSS 隐藏，但容器带 `aria-hidden="true"` 且包含按钮。Gallery 自定义滚动条也带 `aria-hidden="true"` 且包含上下滚动和拖动按钮。两者都应改成：容器本身不隐藏可交互子树；如果控件不可用，用 `disabled` 和 `aria-disabled` 表示。

### Error Announcement

全局错误区 `#errorBanner` 增加 `role="alert"` 和 `aria-live="assertive"`。`showError()` 写入压缩后的错误信息后保留显示；`clearError()` 清空内容并隐藏。局部反馈保持现状，后续按工作流逐步增强。

### Focus Restoration

新增轻量焦点管理 helper：

- 打开抽屉、Prompt Agent、Lightbox 前记录 `document.activeElement`。
- 打开后聚焦对应关闭按钮。
- 关闭后如果触发元素仍在文档中，则恢复焦点。

本批不做完整 focus trap，避免一次性改动过大。

### Public Lib Drift Guard

`sync-public-lib` 的目标列表是共享模块同步事实来源。测试应遍历这份列表，而不是手写少数模块，保证 `npm test` 能发现任意 `public/lib` 漂移。

## Risks

- 现有测试依赖旧的 `aria-hidden` 断言，需要同步更新。
- 焦点恢复不能假设所有打开方式都有真实点击触发，因此 helper 必须容忍空触发元素。
- `scripts/sync-public-lib.mjs` 如果导出目标列表，仍必须保留直接 CLI 执行行为。
