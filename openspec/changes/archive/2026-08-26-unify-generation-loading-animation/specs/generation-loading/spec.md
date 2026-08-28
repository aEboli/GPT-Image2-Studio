## ADDED Requirements

### Requirement: Unified generation loading indicator

所有图片生成入口在没有完整结果时 SHALL 使用同一加载组件，组件 SHALL 只显示一个圆形水滴、百分比和可选的生成状态标签。

#### Scenario: Prompt generation is running

- **WHEN** 提示词生图或风格迁移任务处于运行状态且没有完整图片
- **THEN** 预览区域显示一个 `.generation-loading-drop` 和一个百分比文本
- **AND** 不显示旧的 orb、环形 spinner、扫描线或步骤条；液面只作为圆形水滴内部的单一底部填充层，并不恢复旧的多节点 fluid 动画

#### Scenario: Specialized generation is running

- **WHEN** 套图、写真、文章插图、PPT 页面、图片拆解、融图分析、图片编辑或快速溶图任务处于运行状态且没有完整图片
- **THEN** 对应主预览、卡片或缩略图使用同一共享加载组件
- **AND** 不创建该入口专属的生图动画 DOM

### Requirement: Estimated progress timing and cap

加载组件 SHALL 从 `0%` 开始，每次更新只增加 `1%`。`20%` 及以内的每次 `1%` 间隔 SHALL 为 `800ms`；超过 `20%` 后每跨越一个 `10%` 区间，单次 `1%` 的间隔 SHALL 再增加 `1500ms`。组件 SHALL 停在 `99%` 直到完整图片可用。

#### Scenario: Progress advances within the first 20 percent

- **WHEN** 生图任务仍在运行且下一个百分比不超过 20
- **THEN** 组件在 `800ms` 后将百分比增加 1

#### Scenario: Progress slows down past 20 percent

- **WHEN** 生图任务仍在运行且下一个百分比超过 20
- **THEN** 单次 `1%` 的间隔为 `800ms + ceil((next - 20) / 10) * 1500ms`
- **AND** `21%–30%` 区间为 `2300ms`、`31%–40%` 区间为 `3800ms`、`91%–99%` 区间为 `12800ms`

#### Scenario: Progress reaches the cap

- **WHEN** 估算百分比从 98% 继续更新
- **THEN** 显示变为 99%
- **AND** 不再安排后续百分比 tick

### Requirement: Liquid water appearance

水滴内部 SHALL 表现为真实液体：液面 SHALL 由持续横向流动的波峰与叠加涟漪构成，液体内部 SHALL 有上升气泡，液位 SHALL 在两次百分比更新之间连续上升而不是逐格跳变。低动态偏好下 SHALL 停用这些动画并保留可读的液位与百分比。

#### Scenario: Water surface stays in motion

- **WHEN** 生图任务处于运行状态
- **THEN** 水滴内出现一个位于液面的 `.generation-loading-wave` 层，其波峰与涟漪持续横向流动
- **AND** 液体区域出现持续上升的气泡

#### Scenario: Water level rises continuously

- **WHEN** 估算百分比从 `n%` 更新到 `n+1%`
- **THEN** 液面在本次 tick 间隔内线性上升到新液位
- **AND** 波峰层与液体同步上升

#### Scenario: Reduced motion is preferred

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 呼吸、波峰流动、液面晃动和气泡动画停用
- **AND** 液位高度与百分比文本仍随进度更新

### Requirement: Queued tasks wait instead of showing progress

尚未开始生成的排队任务 SHALL 使用等待态加载动画，SHALL NOT 显示或推进百分比，也 SHALL NOT 安排百分比 tick。任务真正开始生成时 SHALL 切换为生成态并从 `0%` 起算。

#### Scenario: Queued task shows the waiting animation

- **WHEN** 套图项、提示词任务或缩略图处于 `queued` 且尚未开始发送请求
- **THEN** 加载组件的 `data-generation-loading-mode` 为 `waiting`
- **AND** 不显示百分比文本，标签显示“排队等待中”
- **AND** 不存在百分比计时器

#### Scenario: Queued task starts generating

- **WHEN** 同一任务从 `queued` 切换到运行中的生成阶段
- **THEN** 加载组件的 `data-generation-loading-mode` 变为 `generating`
- **AND** 百分比从 `0%` 开始按既定间隔推进

#### Scenario: Running task returns to waiting

- **WHEN** 已在推进百分比的任务重新回到排队等待状态
- **THEN** 百分比计时器被清理且百分比重置为 `0`
- **AND** 不再显示百分比文本

### Requirement: Adjacent same-footprint entries stay visually separated

同一条带中占位尺寸一致的相邻条目 SHALL 有可见分隔，使“队列一”“队列二”这类相邻项不会连成一片。

#### Scenario: Creation queue pills are separated

- **WHEN** 套图记录队列条带同时显示“队列一”和“队列二”
- **THEN** 相邻队列项之间显示分隔线且间距足以区分两项

#### Scenario: Thumbnail strips are separated

- **WHEN** 胶片条或生成缩略图条带相邻显示多个等宽占位或加载条目
- **THEN** 相邻条目之间保持可见分隔

### Requirement: Generation completion and cleanup

当完整图片生成并挂载，或任务离开运行状态时，系统 SHALL 停止对应计时器并移除加载组件；加载组件 SHALL 暴露 0–99 的可访问性数值范围。

#### Scenario: Complete image replaces the loader

- **WHEN** 生成任务返回完整图片
- **THEN** 加载组件的计时器被清理
- **AND** 加载组件从预览容器移除并显示图片

#### Scenario: Generation fails or is replaced

- **WHEN** 任务失败、取消、切换到另一任务或列表移除旧任务
- **THEN** 旧加载组件的计时器被清理
- **AND** 旧组件不会继续更新百分比

### Requirement: Stable shell reuse by generation key

同一生图任务在重复渲染时 SHALL 复用现有加载 DOM 和当前百分比；当 `loadingKey` 改变时 SHALL 清理旧任务并重置到 `0%`。

#### Scenario: Re-render the same task

- **WHEN** 同一 `loadingKey` 的状态因轮询或 SSE 更新而重新渲染
- **THEN** `.generation-loading-drop` 节点引用保持不变
- **AND** 百分比不会因为重渲染回到 0

#### Scenario: Switch to another task

- **WHEN** loading 状态切换到不同的 `loadingKey`
- **THEN** 旧 timer 被清理
- **AND** 新任务从 0% 创建或更新
