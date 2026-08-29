## 1. 参考录屏解析

- [x] 1.1 用 Electron 解码参考录屏（1852×1080、60fps、535 帧），逐帧测量抖动区间的位移。
- [x] 1.2 用列亮度剖面 SSD 匹配确认运动性质：纯横向刚体位移，垂直位移小于 0.4px，无缩放、无不透明度或颜色变化，结束帧与静止帧逐像素一致（最佳位移处 SSD 精确为 0）。
- [x] 1.3 在三段独立点击上复测，确认波形可复现：时长约 183–200ms、峰值位移约为元素宽度的 12%、约 6–7 次反向并逐次衰减。

## 2. 抖动样式

- [x] 2.1 在 `public/styles.css` 新增 `.is-disabled-shaking` 状态类与 `control-disabled-shake` 关键帧：200ms、`ease-out`、9 个停顿点、纯 `translate3d` 横向位移、首尾均为原位。
- [x] 2.2 幅度通过 `--control-disabled-shake-distance` 暴露，默认 `8px`（按本应用控件尺寸缩放，参考录屏元素宽约 460–525px 时为 57px）。
- [x] 2.3 紧随其后新增 `@media (prefers-reduced-motion: reduce)` 块，以 `animation: none` 关闭动画。

## 3. 全局触发模块

- [x] 3.1 新增 `lib/disabled-shake.mjs`，在 `document` 捕获阶段监听 `pointerdown`（原生禁用控件只派发这一个事件）。
- [x] 3.2 先 `closest()` 命中禁用控件；命中不到时在事件目标子树内用 `getBoundingClientRect()` 做矩形命中测试，找回被 `pointer-events: none` 隐藏的控件，多层命中时取面积最小者。
- [x] 3.3 加类前强制一次样式重算以支持连点重放；到期清类，`destroy()` 释放监听并清理在途状态。
- [x] 3.4 将模块登记进 `scripts/sync-public-lib.mjs` 的同步清单并执行同步。
- [x] 3.5 在 `public/app.js` 导入、实例化，并在 `bindEvents()` 内绑定。

## 4. 验证

- [x] 4.1 新增 `test/disabled-shake.test.mjs`：解析逻辑、重放、捕获阶段、销毁清理、样式契约、命中测试清单与样式表 `pointer-events: none` 规则一致、`public/lib` 镜像逐字节相等。
- [x] 4.2 用 Electron 探针在真实引擎确认：五类禁用控件点击后都加上状态类（含 `pointer-events: none` 路径），波形为 200ms／峰值 8px／6 次反向／收尾归零，三处声明 `transform: none` 的禁用规则不会取消动画。
- [x] 4.3 用 `Emulation.setEmulatedMedia` 模拟 `prefers-reduced-motion: reduce`，确认 `getAnimations()` 为空。
- [x] 4.4 同步资源版本号到 `20260830-disabled-shake-1`，并更新钉住它的三个测试文件。
- [x] 4.5 跑通受影响测试与 `openspec validate --strict`。
