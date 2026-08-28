## Context

工作区中主预览和多个专用生图视图各自维护加载 DOM 与 CSS 动画。部分入口使用多层 orb/liquid 结构，套图使用 sketch ring 和步骤条，缩略图又使用独立 spinner/scan。不同组件还需要在轮询重渲染时保留节点，并在图片返回或任务替换时停止动画。

## Goals / Non-Goals

**Goals:**

- 提供唯一的生图加载 DOM 契约和计时器生命周期。
- 在所有图片生成入口显示一致的圆形水滴与 `0%–99%` 进度。
- 任务 key 改变时重置进度，同一任务重渲染时保留 DOM 节点和当前百分比。
- 通过响应式 CSS 适配主预览、卡片和胶片条，并支持减少动态效果偏好。

**Non-Goals:**

- 百分比不是服务端真实进度，不修改生成 API、SSE 协议或任务状态模型。
- 不把图片分析、提示词反推、PPT 解析等非生图操作改成水滴加载器。
- 不改变图片完成、失败、重试和历史记录业务逻辑。

## Decisions

### 共享模块负责进度和生命周期

`lib/generation-loading.mjs` 导出创建、更新、停止和批量停止函数。组件内部保存 `progress`、`key`、`active` 和 timer，使用递归 `setTimeout` 调度，每次只增加 1，封顶 99。间隔由 `getGenerationLoadingInterval(progress)` 决定：下一个百分比不超过 20 时为 800ms，超过 20 后按 `800ms + ceil((next - 20) / 10) * 1500ms` 递增，使早期反馈明显、后期逐段放缓以贴合长任务。选择 `setTimeout` 而不是 `setInterval` 是为了支持逐 tick 变化的间隔、避免回调漂移和停止后仍有重复 tick；在 Node 环境中对 timer 调用可选的 `unref`，不阻塞测试进程。

### DOM 只保留一个视觉主体

组件只生成 `.generation-loading-shell`、`.generation-loading-drop`、`.generation-loading-wave`、`.generation-loading-percent` 和 `.generation-loading-label`。水滴使用单个圆形元素，内部液体从底部按百分比上升；百分比显示在圆形元素外侧。组件不再生成 orb、ring、scan、fluid 或 step 子树，也不使用环形/时钟式进度盘。

液体感由四层构成，均在同一个圆形元素内：`::after` 是按百分比的液体本体，`.generation-loading-wave` 是贴在液面的波峰带（`::before` 为主波峰、`::after` 为反向涟漪，用重复 `radial-gradient` 平铺并按整块 tile 宽度平移以无缝循环），`::before` 是限制在液位内的气泡与高光层。只有一个额外 DOM 节点，是因为一个元素最多提供两个伪元素，而互相错拍的波峰与涟漪需要两条独立动画。

液位不再用固定过渡时长：`renderGenerationLoadingProgress` 把当前 tick 间隔写入 `--generation-loading-rise-duration`，液体与波峰以 `linear` 在整个间隔内升到新液位，因此看起来是连续上涨而不是每次跳一格。

### 排队与生成分成两种模式

组件用 `mode` 区分 `waiting` 和 `generating`，并写入 `data-generation-loading-mode` 供样式选择。`waiting` 不注册共享进度源、不安排 tick、百分比文本留空，标签显示“排队等待中”，视觉上是一潭静止的浅水加缓慢呼吸的涟漪圈；`generating` 才进入既有的百分比与水位逻辑。两种模式互相切换时按 key 变化同样处理，先停表并把进度重置为 0，因此排队任务开始生成时一定从 `0%` 起算，不会继承任何残留百分比。

判定来源保持在各入口：套图卡片按 item 状态是否为 `queued`，提示词预览与胶片条用 `isWaitingPreviewItem` 判断原始 `statusStage`（`queued` 且未 `started`/`isRunning`）。之所以在 `preview-placeholder-state.mjs` 另加一个显式判定函数，是因为 `normalizeStage` 会把 `queued` 归并成 `connecting`，阶段值本身已经丢失排队信息。

### 相邻等宽条目用分隔线区分

队列条带和缩略图条带里的条目宽度一致、样式相同，连排时容易看成一整条。对没有 `overflow: hidden` 的条目（`.creation-queue-item`、`.filmstrip-entry`）用相邻兄弟伪元素在间距中画一条细分隔线；对 `overflow: hidden` 会裁掉伪元素的条目（融图分析缩略图）改为加大 `gap`。移动端队列条带竖排时把分隔线转成横向。

### 通过稳定 key 控制复用

预览状态暴露 `loadingKey`。同一 key 的 loading shell 在重渲染时复用，以保留当前百分比；key 变化时先清理旧 timer 并从 0% 开始。非 loading、图片完成和列表替换路径统一调用停止函数。

### 入口按容器复用同一组件

主预览与图片拆解/融图分析等预览使用共享 shell 包装；套图和写真使用 creation-card loader；文章、PPT 及各类 generation filmstrip 在无图片且任务运行时直接插入共享 shell。记录历史页只显示已保存图片或静态状态，不启动新的 loader。

### 保留非生图加载反馈

按钮级分析、参考图识别、提示词反推和资源读取等操作不属于图片生成预览，继续使用现有按钮 busy 样式，避免把不同业务状态混为一谈。

## Risks / Trade-offs

- [进度与真实生成速度无关] -> 明确封顶 99%，只有图片完整可用时才结束并显示图片。
- [大量缩略图同时生成 timer] -> 每个 shell 只保留一个 timer；列表重建前批量停止旧 shell；Node timer 使用 `unref`。
- [旧 CSS/DOM 仍被缓存引用] -> 同步脚本覆盖 `public/lib`，测试扫描旧 class 和 keyframe，浏览器验证确认只出现共享组件。
- [低动态偏好下视觉变化减少] -> `prefers-reduced-motion` 禁用呼吸、波峰、晃动和气泡动画，不影响液位高度、百分比更新和可读文本。
- [后期百分比推进很慢] -> 这是刻意的：`91%–99%` 每格 12.8s，让长任务不会提前贴住 99%；封顶仍为 99%，只有图片可用时才结束。

## Migration Plan

先添加共享模块和测试，再迁移主预览、专用视图、卡片和缩略图入口；随后删除旧 CSS 与 DOM 断言，运行 `npm run sync:public-lib` 保持 public 副本一致。若出现回归，可通过回退本次前端文件恢复旧视觉，不涉及服务端数据迁移。

## Open Questions

无。百分比为前端估算值且统一封顶 99% 已由需求确定。
