## MODIFIED Requirements

### Requirement: Unified generation loading indicator

所有图片生成入口在没有完整结果时 SHALL 使用同一加载组件，组件 SHALL 只显示一个铺满图片占位框的动态模糊背景、百分比和可选的生成状态标签。动态背景 SHALL NOT 绘制液位、波面、气泡、水流或其他以填充高度表达进度的图层。

#### Scenario: Prompt generation is running

- **WHEN** 提示词生图或风格迁移任务处于运行状态且没有完整图片
- **THEN** 预览区域显示一个 `.generation-loading-shell`、动态模糊背景和一个百分比文本
- **AND** 不显示旧的 orb、环形 spinner、扫描线、步骤条、液位、波面或气泡

#### Scenario: Specialized generation is running

- **WHEN** 套图、写真、文章插图、PPT 页面、图片拆解、融图分析、图片编辑或快速溶图任务处于运行状态且没有完整图片
- **THEN** 对应主预览、卡片或缩略图使用同一共享加载组件
- **AND** 不创建该入口专属的生图动画 DOM

### Requirement: Loading animation fills its host image slot

加载动画 SHALL 铺满承载它的图片占位框，尺寸 SHALL 由宿主决定而不是由动画自身写死：大生图板块 SHALL 得到大动画，逐项占位 SHALL 各自得到刚好填满自己占位的小动画。动态模糊背景 SHALL 在不同宿主中保持软边且不露出宿主底色。百分比、状态标签与实时日志 SHALL 保持居中且 SHALL NOT 随宿主尺寸改变自身排版。

#### Scenario: Large preview panel gets a large animation

- **WHEN** 提示词模式主预览处于生成中
- **THEN** 动画背景铺满整个图片画布，四边与占位框对齐且无留边
- **AND** 画布在生成期间不因内边距把动画缩进一圈

#### Scenario: Per-item placeholders each fill their own slot

- **WHEN** 套图模式多张卡片同时生成
- **THEN** 每张卡的动画分别铺满自己的 `.creation-card-media` 占位框，彼此按卡片间距隔开
- **AND** 相邻卡片的动画不连成一片

#### Scenario: Water detail scales with the host

- **WHEN** 同一动画分别渲染在大预览板块与胶片条缩略图中
- **THEN** 模糊背景覆盖整个宿主且没有可辨认的水纹、气泡或平铺图案

#### Scenario: Centered text stays unchanged

- **WHEN** 动画从小占位切换到大板块
- **THEN** 百分比、状态标签与日志仍居中显示且字号排版不变
- **AND** 文字层压在动画背景之上并保持可读对比度

#### Scenario: Text and icon stay legible over the coloured fill

- **WHEN** 动态模糊背景位于文字与图标正后方
- **THEN** 百分比、状态标签、日志与心跳图标相对其正后方底色的对比度不低于 4.5:1
- **AND** 深色与浅色主题各自处理，SHALL NOT 沿用会糊进背景的 `--muted` 级灰度

### Requirement: Heartbeat is shown as a morphing icon

生成加载壳创建时 SHALL 从 20 个同描边风格的图标池（含星、月、日、心）中随机选择一个初始图标。相同 `loadingKey` 的重复渲染 SHALL 保留该初始图标；新建的加载壳 SHALL 重新随机选择。上游心跳 SHALL 以图标变形呈现：每收到一次 heartbeat，图标 SHALL 随机变形切换一次且 SHALL NOT 连续两次选中同一图标。图标 SHALL NOT 自带轮换定时器。

图标 SHALL 只出现在能显示状态文本的宿主中，等待态 SHALL NOT 显示。图标 SHALL 取代心跳文本本身，且该取代 SHALL 覆盖全部展示位：加载组件日志行、生成日志时间线的明细行、以及各板块的反馈条，SHALL NOT 再打印心跳文本，因为图标已经表达了同一件事。生成日志时间线 SHALL 保留该行的摘要与该行本身（任务仍需看得出在运行），只清除重复的心跳明细。反馈条 SHALL NOT 被心跳文本覆盖，以免每 15 秒把真正带信息的阶段文本顶掉。其余状态文本（`正在生成图片`、`正在保存到本地图片目录` 等）SHALL 照旧显示。

批量板块（套图、写真等）的每一项 SHALL 各自拥有加载壳，收到心跳的那一项 SHALL 变形自己的图标，同批次的其它项 SHALL NOT 被带动——否则无法分辨是哪一项还活着。

#### Scenario: A new generation starts with a random icon

- **WHEN** 创建一个新的生成加载壳且未指定固定图标索引
- **THEN** 初始图标从完整图标池随机选择，而不是固定显示星形
- **AND** 重复渲染同一 `loadingKey` 不重新随机选择

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

### Requirement: Stable shell reuse by generation key

同一生图任务在重复渲染时 SHALL 复用现有加载 DOM、当前百分比和初始随机图标；当 `loadingKey` 改变时 SHALL 清理旧任务并重置到 `0%`，新加载壳 SHALL 重新随机选择初始图标。

#### Scenario: Re-render the same task

- **WHEN** 同一 `loadingKey` 的状态因轮询或 SSE 更新而重新渲染
- **THEN** `.generation-loading-shell` 节点与其当前图标引用保持不变
- **AND** 百分比不会因为重渲染回到 0

#### Scenario: Switch to another task

- **WHEN** loading 状态切换到不同的 `loadingKey`
- **THEN** 旧 timer 被清理
- **AND** 新任务从 0% 创建或更新，并随机选择新的初始图标

### Requirement: Stage hue and progress depth

加载组件 SHALL 用两个维度合成动态模糊背景颜色：色相 SHALL 由真实请求阶段决定，深浅 SHALL 由当前百分比决定。色相族 SHALL 取自既有 `statusStage`，SHALL NOT 引入不对应真实阶段的自造阶段名。组件 SHALL 暴露 `data-generation-loading-stage` 与 `data-generation-loading-family`，动态模糊背景和中心可读性遮罩 SHALL 由同一个合成颜色取色。颜色 SHALL NOT 改变百分比时序、`99%` 上限或等待态语义。

#### Scenario: Hue follows the real request stage

- **WHEN** 任务的 `statusStage` 依次为 `queued`、`uploading`、`connecting`、`generating`、`saving`
- **THEN** `data-generation-loading-family` 依次为 `queued`、`uploading`、`connecting`、`generating`、`saving`
- **AND** 动态模糊背景的色相随之改变，且与界面上显示的阶段文字同源

#### Scenario: Fetch and retry stages share one family

- **WHEN** `statusStage` 为 `waiting_upstream`、`waiting_final`、`retrying_upstream`、`missing_final_recovery`、`fallback_final_image`、`recovering_original`、`waiting_original` 或 `recovery_unavailable`
- **THEN** `data-generation-loading-family` 为 `recovering`
- **AND** 背景使用区别于生成阶段的告知性色相

#### Scenario: Failure stages use the failure family

- **WHEN** `statusStage` 为 `error`、`failed` 或 `original_failed`
- **THEN** `data-generation-loading-family` 为 `failed`

#### Scenario: Depth deepens with the percentage

- **WHEN** 同一阶段内百分比从低位升到高位
- **THEN** 动态模糊背景颜色在该色相族内平滑变化
- **AND** 长阶段内部也能看出推进，但不出现液位或填充高度

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
- **AND** 百分比文本不受影响

#### Scenario: Families keep a comparable perceived brightness

- **WHEN** 逐个查看七个色相族在同一百分比下的动态模糊背景
- **THEN** 各族的感知亮度接近，没有哪个阶段明显更刺眼或更发闷
- **AND** 青与绿这类本身偏亮的色相起始亮度低于紫与红这类偏暗的色相

#### Scenario: Light theme keeps contrast

- **WHEN** 界面处于浅色主题
- **THEN** 背景整体亮度低于深色主题下的同族颜色
- **AND** 背景与浅色界面保持可辨识的对比度
- **AND** 主题以亮度偏移方式调整，各族按感知亮度做的校准在浅色主题下同样生效

#### Scenario: Reduced motion keeps stage colors

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 动态模糊背景的位移、缩放和呼吸动画停用
- **AND** 当前阶段颜色与百分比仍然按进度呈现

## REMOVED Requirements

### Requirement: Liquid water appearance

**Reason**: 水位、波面、气泡和水流会在生成画布中形成高干扰的底部动画，与仅保留动态模糊背景的体验不符。

**Migration**: 使用“动态模糊背景”承载运行态视觉反馈，百分比和阶段颜色继续表达任务进度。

### Requirement: Stage-based water color

**Reason**: 阶段颜色不再驱动水体、波峰或涟漪，旧的百分比分段水体语义已不存在。

**Migration**: 使用“Stage hue and progress depth”要求中的真实 `statusStage` 色相族和百分比深浅驱动动态模糊背景。

## ADDED Requirements

### Requirement: Animated blurred loading background

生成中的加载壳 SHALL 以一个铺满宿主的动态模糊背景表达运行状态。背景 SHALL 使用连续、低干扰的柔和光带或等效软边效果；它 SHALL NOT 呈现液位、波面、气泡、水流、可辨认的平铺图案或按百分比改变填充高度的动画。运行态背景 SHALL 有缓慢、平滑的位移或透明度变化，且 SHALL NOT 遮挡中心百分比、状态文本、实时日志或心跳图标。等待态 SHALL 使用同类但更弱、更慢的背景。

#### Scenario: Running generation has only the blurred dynamic

- **WHEN** 任一共享加载壳处于生成态
- **THEN** 用户只看到动态模糊背景、中心进度和状态内容
- **AND** DOM 和样式均不绘制液位、波面、气泡或水流动画

#### Scenario: The blurred background moves smoothly

- **WHEN** 生成任务持续运行
- **THEN** 背景以缓慢连续的方式变化，不出现快速跳动或明显的重复图案
- **AND** 背景色相在阶段或进度更新时平滑过渡

#### Scenario: Waiting background remains subdued

- **WHEN** 加载壳处于等待态
- **THEN** 背景保持可见但比生成态更弱、更慢
- **AND** 不显示或推进百分比

#### Scenario: Reduced motion freezes only the visual movement

- **WHEN** 用户开启 `prefers-reduced-motion: reduce`
- **THEN** 动态模糊背景不再播放位移、缩放、透明度或呼吸动画
- **AND** 百分比、阶段颜色、状态文本与可访问性语义照旧更新
