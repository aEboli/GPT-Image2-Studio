## Why

禁用控件目前只有静态表现：降低不透明度、`cursor: not-allowed`，少数还带 `pointer-events: none`。用户点下去没有任何反应，无法区分「我点空了」「页面卡住了」和「这个控件现在不可用」，只能靠悬停 tooltip 事后解释。参考录屏给出的做法是点击即抖一下：不改变可用性，只把「点到了、但用不了」这件事立刻说清楚。

逐组件补这个反馈不可行。`public/styles.css` 里有 24 处各自独立的禁用样式，没有任何共用基础选择器，不透明度取值从 0.34 到 0.7 不等；而且实测确认两个浏览器行为会让常规做法失效：原生 `disabled` 控件被点击时只派发 `pointerdown`，`click`/`mousedown` 一个都不派发；带 `pointer-events: none` 的禁用控件连 `pointerdown` 都收不到，事件改指向祖先，`document.elementFromPoint()` 也查不到它。因此需要一处全局入口统一处理，而不是 24 处各写一遍。

## What Changes

- 新增浏览器模块 `lib/disabled-shake.mjs`：在 `document` 捕获阶段监听 `pointerdown`，先用 `closest()` 命中禁用控件，命中不到时在事件目标子树内做矩形命中测试，找回被 `pointer-events: none` 隐藏的控件；命中后给控件本身加一次性状态类。
- 新增全局状态类 `.is-disabled-shaking` 与关键帧 `control-disabled-shake`：200ms、纯横向 `translate3d`、峰值 8px、7 次反向并逐次衰减、精确回到原位；幅度由 `--control-disabled-shake-distance` 暴露给组件覆盖。
- `prefers-reduced-motion: reduce` 下以 `animation: none` 关闭该动画。
- 覆盖范围包含原生 `disabled` 控件、`aria-disabled="true"` 控件、以及本仓库用于禁用态的 `.disabled` / `.is-disabled` 类名控件；连续点击可重放，非主键点击不触发。
- 「导出 Temu Excel」：把 `passesOpenGuards` 里已有的两句拦截原因抽成 `getOpenBlockReason()`；按钮禁用时在捕获阶段复用 `resolveDisabledShakeTarget()` 认出它，把同一句原因写进套图记录已有的 `aria-live` 反馈区 `#creationRecordActionFeedback`；按钮恢复可用时撤回该提示，且不覆盖之后写入的新反馈。

## Capabilities

### Modified Capabilities

- `workbench-usability-foundation`：新增「点击禁用控件给出抖动反馈」的跨模式全局要求。

## Impact

- 新增：`lib/disabled-shake.mjs`、`public/lib/disabled-shake.mjs`（镜像）、`test/disabled-shake.test.mjs`
- 修改：`public/styles.css`（新增状态类、关键帧、reduced-motion 块）、`public/app.js`（导入、实例化、`bindEvents()` 内绑定）、`scripts/sync-public-lib.mjs`（同步清单）
- 资源版本号 `20260830-disabled-shake-1`：`public/index.html` 两处，以及钉住它的 `test/studio-preview-layout.test.mjs`、`test/creation-card-idle-ripple.test.mjs`、`test/portrait-cosplay-assets.test.mjs`
- 修改：`lib/creation-temu-export-ui.mjs`（含 `public/lib` 镜像）、`test/creation-temu-frontend.test.mjs`
- 原因播报不改 `public/index.html`／`public/styles.css`／`public/app.js`，资源版本号不变：`/lib/` 与 `public/` 静态资源已按 `no-cache` + ETag 下发（`server.mjs` `getStaticCacheControl`）。

## Non-Goals

- 不改动任何现有禁用规则的 `pointer-events`、`opacity`、`cursor` 取值，也不改变任何控件的可用性判定。
- 不为没有现成原因文案的禁用控件新增文案，也不新增 toast 或新的播报区域；本次只让已有原因的控件把它说出来。
- 不为容器类元素（`fieldset`、滚动条轨道等）播放抖动，只针对控件本身。
