# generation-loading Specification

## Purpose
TBD - created by archiving change unify-generation-loading-animation. Update Purpose after archive.
## Requirements
### Requirement: Unified generation loading indicator

所有图片生成入口在没有完整结果时 SHALL 使用同一加载组件，组件 SHALL 只显示一个铺满图片占位框的动画层、百分比和可选的生成状态标签。

#### Scenario: Prompt generation is running

- **WHEN** 提示词生图或风格迁移任务处于运行状态且没有完整图片
- **THEN** 预览区域显示一个 `.generation-loading-drop` 和一个百分比文本
- **AND** 不显示旧的 orb、环形 spinner、扫描线或步骤条；液面只作为动画层内部的单一底部填充层，并不恢复旧的多节点 fluid 动画

#### Scenario: Specialized generation is running

- **WHEN** 套图、写真、文章插图、PPT 页面、图片拆解、融图分析、图片编辑或快速溶图任务处于运行状态且没有完整图片
- **THEN** 对应主预览、卡片或缩略图使用同一共享加载组件
- **AND** 不创建该入口专属的生图动画 DOM

### Requirement: Loading animation fills its host image slot

加载动画 SHALL 铺满承载它的图片占位框，尺寸 SHALL 由宿主决定而不是由动画自身写死：大生图板块 SHALL 得到大动画，逐项占位 SHALL 各自得到刚好填满自己占位的小动画。水纹与气泡尺度 SHALL 随宿主尺寸成比例换算。百分比、状态标签与实时日志 SHALL 保持居中且 SHALL NOT 随宿主尺寸改变自身排版。

#### Scenario: Large preview panel gets a large animation

- **WHEN** 提示词模式主预览处于生成中
- **THEN** 动画层铺满整个图片画布，四边与占位框对齐且无留边
- **AND** 画布在生成期间不因内边距把动画缩进一圈

#### Scenario: Per-item placeholders each fill their own slot

- **WHEN** 套图模式多张卡片同时生成
- **THEN** 每张卡的动画分别铺满自己的 `.creation-card-media` 占位框，彼此按卡片间距隔开
- **AND** 相邻卡片的动画不连成一片

#### Scenario: Water detail scales with the host

- **WHEN** 同一动画分别渲染在大预览板块与胶片条缩略图中
- **THEN** 波高、涟漪与气泡尺度按宿主尺寸成比例缩放，而不是两处使用同一绝对厚度

#### Scenario: Centered text stays unchanged

- **WHEN** 动画从小占位切换到大板块
- **THEN** 百分比、状态标签与日志仍居中显示且字号排版不变
- **AND** 文字层压在动画层之上并保持可读对比度

#### Scenario: Text and icon stay legible over the coloured fill

- **WHEN** 水位涨到文字与图标的正后方
- **THEN** 百分比、状态标签、日志与心跳图标相对其正后方底色的对比度不低于 4.5:1
- **AND** 深色与浅色主题各自处理，SHALL NOT 沿用会糊进水体的 `--muted` 级灰度

### Requirement: Heartbeat is shown as a morphing icon

上游心跳 SHALL 以一个变形图标呈现：每收到一次 heartbeat，图标 SHALL 变形切换一次，一次切换即代表一次心跳唤起。
图标池 SHALL 为 20 个同描边风格的图标（含星、月、日、心），切换 SHALL 随机且 SHALL NOT 连续两次选中同一图标——
连选同一个会让界面看不出变化，那一次心跳就无从感知。图标 SHALL 只由心跳事件驱动，SHALL NOT 自带轮换定时器。
图标 SHALL 只出现在能显示状态文本的宿主中，等待态 SHALL NOT 显示。
图标 SHALL 取代心跳文本本身，且该取代 SHALL 覆盖全部展示位：加载组件日志行、生成日志时间线的明细行、
以及各板块的反馈条，SHALL NOT 再打印心跳文本，因为图标已经表达了同一件事。
生成日志时间线 SHALL 保留该行的摘要与该行本身（任务仍需看得出在运行），只清除重复的心跳明细。
反馈条 SHALL NOT 被心跳文本覆盖，以免每 15 秒把真正带信息的阶段文本顶掉。
其余状态文本（`正在生成图片`、`正在保存到本地图片目录` 等）SHALL 照旧显示。

批量板块（套图、写真等）的每一项 SHALL 各自拥有加载壳，收到心跳的那一项 SHALL 变形自己的图标，
同批次的其它项 SHALL NOT 被带动——否则无法分辨是哪一项还活着。

#### Scenario: Each heartbeat switches the icon

- **WHEN** 上游在同一任务上连续推来多次 heartbeat 状态
- **THEN** 图标每次都变形到一个不同的图标
- **AND** 相邻两次心跳不会显示同一个图标

#### Scenario: Only real heartbeats advance the icon

- **WHEN** 到达的状态是 `正在生成图片`、`排队中`、`上游重试` 等非心跳文本
- **THEN** 图标保持当前形状不变

#### Scenario: Icon is absent where the status text is

- **WHEN** 加载组件渲染在不显示状态文本的小占位（胶片条缩略图等）或处于等待态
- **THEN** 不显示心跳图标
- **AND** 百分比与既有排版不受影响

#### Scenario: Heartbeat text is replaced by the icon

- **WHEN** 到达的状态文本是 `heartbeat（15 秒）：上游服务仍在处理，请保持页面打开` 这类心跳文本
- **THEN** 日志行不显示该文本
- **AND** 心跳图标仍然显示并按本次心跳变形

#### Scenario: The generation log timeline drops the repeated heartbeat detail

- **WHEN** 生成日志时间线里某一项的明细是 `heartbeat（15 秒）：仍在等待最终图，请保持页面打开`
- **THEN** 该行保留摘要 `图片生成中`，不显示心跳明细行
- **AND** 非心跳明细（`上游重试：第 2 次`、`缺最终图补救：…` 等）照旧显示

#### Scenario: The heartbeat never overwrites a feedback banner

- **WHEN** 心跳状态到达套图、图片拆解、图片编辑或快速溶图板块
- **THEN** 反馈条保留上一条真正带信息的阶段文本，不被心跳文本覆盖

#### Scenario: In a batch, only the item that received the heartbeat morphs

- **WHEN** 套图批量生成中，上游对其中一项推来心跳
- **THEN** 只有该项的卡片图标变形
- **AND** 同批次其它项的图标保持不变

#### Scenario: Other status text still shows

- **WHEN** 到达的状态文本是 `正在保存到本地图片目录` 这类非心跳文本
- **THEN** 日志行照旧显示该文本
- **AND** 图标保持当前形状不变

#### Scenario: Missing morph engine degrades instead of disappearing

- **WHEN** 变形引擎未能加载或构造失败
- **THEN** 图标仍然按心跳切换形状，只是不做补间动画

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

动画层内部 SHALL 表现为像水龙头放水一样持续上涨的水体：液位 SHALL 在两次百分比更新之间连续上升而不是逐格跳变，
液面 SHALL 是一条柔和的液面高光，SHALL NOT 由平铺的半圆阵列构成，也 SHALL NOT 做横向漂移或整体左右摇摆——
平铺图案会给视线一排可对齐的参照物，使连续上升被读成逐格跳变。液体内部 SHALL 有上升气泡与自下而上流过的柔光，
使高百分比区间液位几乎不动时画面仍有自然的向上流动感。低动态偏好下 SHALL 停用这些动画并保留可读的液位与百分比。

#### Scenario: Water surface stays smooth and level

- **WHEN** 生图任务处于运行状态
- **THEN** 动画层内出现一个位于液面的 `.generation-loading-wave` 层，表现为一条柔和的高光带
- **AND** 液面不出现半圆阵列，也不做横向位移或旋转
- **AND** 液体区域出现持续上升的气泡与自下而上的柔光

#### Scenario: Water level rises continuously

- **WHEN** 估算百分比从 `n%` 更新到 `n+1%`
- **THEN** 液面在本次 tick 间隔内线性上升到新液位，期间不出现静止后突然跳变
- **AND** 单次过渡时长等于到下一次 tick 的时间，液位因此始终在移动
- **AND** 液面高光与液体同步上升

#### Scenario: Reduced motion is preferred

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 呼吸、光雾漂移、液面呼吸、水体柔光与气泡动画全部停用
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

### Requirement: Stage-based water color

加载组件 SHALL 按当前阶段区分水体颜色，阶段 SHALL 由模式和百分比推导：排队等待为 `waiting`，`0%–20%` 为 `warmup`，`21%–50%` 为 `drafting`，`51%–80%` 为 `rendering`，`81%–99%` 为 `finishing`。组件 SHALL 在 DOM 上暴露 `data-generation-loading-stage`，水体的液体填充、波峰、涟漪与环境光雾 SHALL 由同一个阶段颜色变量取色。颜色 SHALL 只表达阶段，SHALL NOT 改变百分比时序、`99%` 上限或等待态语义。

#### Scenario: Stage advances with the percentage bands

- **WHEN** 生成态百分比依次经过 `20%`、`21%`、`50%`、`51%`、`80%`、`81%`
- **THEN** `data-generation-loading-stage` 依次为 `warmup`、`drafting`、`drafting`、`rendering`、`rendering`、`finishing`
- **AND** 水体填充、波峰与涟漪同时切换到该阶段的颜色

#### Scenario: Queued task keeps the waiting color

- **WHEN** 加载组件处于等待态
- **THEN** `data-generation-loading-stage` 为 `waiting` 且与百分比无关
- **AND** 水体使用灰调而不是任一生成阶段配色

#### Scenario: Stage color changes smoothly

- **WHEN** 阶段从一段切换到下一段
- **THEN** 水体颜色在过渡时长内平滑插值而不是硬切
- **AND** 液位上升时序与百分比文本不受影响

#### Scenario: Light theme keeps contrast

- **WHEN** 界面处于浅色主题
- **THEN** 各阶段使用同色系的深色版本
- **AND** 水体与浅色背景保持可辨识的对比度

#### Scenario: Reduced motion keeps stage colors

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 波峰流动、气泡与呼吸动画仍然停用
- **AND** 当前阶段颜色与液位高度仍然按进度呈现

### Requirement: Stage hue and progress depth

加载组件 SHALL 用两个维度合成水体颜色：色相 SHALL 由真实请求阶段决定，深浅 SHALL 由当前百分比决定。色相族 SHALL 取自既有 `statusStage`，SHALL NOT 引入不对应真实阶段的自造阶段名。组件 SHALL 暴露 `data-generation-loading-stage` 与 `data-generation-loading-family`，水体的液体填充、波峰、涟漪与环境光雾 SHALL 由同一个合成颜色取色。颜色 SHALL NOT 改变百分比时序、`99%` 上限或等待态语义。

#### Scenario: Hue follows the real request stage

- **WHEN** 任务的 `statusStage` 依次为 `queued`、`uploading`、`connecting`、`generating`、`saving`
- **THEN** `data-generation-loading-family` 依次为 `queued`、`uploading`、`connecting`、`generating`、`saving`
- **AND** 水体色相随之改变，且与界面上显示的阶段文字同源

#### Scenario: Fetch and retry stages share one family

- **WHEN** `statusStage` 为 `waiting_upstream`、`waiting_final`、`retrying_upstream`、`missing_final_recovery`、`fallback_final_image`、`recovering_original`、`waiting_original` 或 `recovery_unavailable`
- **THEN** `data-generation-loading-family` 为 `recovering`
- **AND** 水体使用区别于生成阶段的告知性色相

#### Scenario: Failure stages use the failure family

- **WHEN** `statusStage` 为 `error`、`failed` 或 `original_failed`
- **THEN** `data-generation-loading-family` 为 `failed`

#### Scenario: Depth deepens with the percentage

- **WHEN** 同一阶段内百分比从低位升到高位
- **THEN** 水体颜色在该色相族内变深
- **AND** 长阶段内部也能看出推进

#### Scenario: Missing stage keeps the last known stage

- **WHEN** 重渲染时调用点没有提供阶段
- **THEN** 组件保留上一次已知阶段与色相族
- **AND** 颜色不退回默认族

#### Scenario: Unknown stage does not guess a later stage

- **WHEN** 阶段取值为空或不在已知列表中
- **THEN** 等待态归入 `queued` 族，其余归入 `generating` 族
- **AND** 不显示写入或失败族的颜色

#### Scenario: Stage color changes smoothly

- **WHEN** 阶段从一段切换到下一段
- **THEN** 色相与饱和度在过渡时长内平滑插值而不是硬切
- **AND** 液位上升时序与百分比文本不受影响

#### Scenario: Families keep a comparable perceived brightness

- **WHEN** 逐个查看七个色相族在同一百分比下的水体颜色
- **THEN** 各族的感知亮度接近，没有哪个阶段明显更刺眼或更发闷
- **AND** 青与绿这类本身偏亮的色相起始亮度低于紫与红这类偏暗的色相

#### Scenario: Light theme keeps contrast

- **WHEN** 界面处于浅色主题
- **THEN** 水体整体亮度低于深色主题下的同族颜色
- **AND** 水体与浅色背景保持可辨识的对比度
- **AND** 主题以亮度偏移方式调整，各族按感知亮度做的校准在浅色主题下同样生效

#### Scenario: Reduced motion keeps stage colors

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 波峰流动、气泡与呼吸动画仍然停用
- **AND** 当前阶段色相与按百分比的深浅仍然呈现

