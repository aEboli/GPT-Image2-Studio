## ADDED Requirements

### Requirement: 通用按钮以内联模糊动态表达忙碌状态

主 Studio 中已有运行时忙碌反馈的通用命令按钮 SHALL 保留现有忙碌文案、最小宽度、`aria-busy`、禁用状态和提交行为，并在按钮边界内以低干扰的模糊光晕或光带表达运行中状态。该装饰 SHALL NOT 使用横向扫光、跳动圆点或环形 spinner，且 SHALL NOT 新增焦点目标或可访问文本。

#### Scenario: 通用命令正在处理

- **WHEN** 一个使用既有内联忙碌反馈的命令按钮处于异步处理状态
- **THEN** 按钮保留原有文字、最小宽度、禁用与 `aria-busy` 状态
- **AND** 按钮内只显示受自身边界裁切的柔和模糊动态

### Requirement: 运行中的参考与 Prompt Agent 分析使用模糊覆盖层

套图参考识别、Prompt Agent 图片分析预览及其三条分析轨道在运行时 SHALL 使用低对比度、受宿主裁切的模糊光晕或光带。它们 SHALL NOT 以旋转边框、锐利扫描线或伪进度扫光作为主要运行态视觉，并 SHALL 保留既有预览内容、说明文字和可操作控件的可读性与可用性。

#### Scenario: 套图参考识别正在运行

- **WHEN** 套图参考图正在识别
- **THEN** 参考识别区域显示低对比度的模糊动态
- **AND** 既有识别状态语义和参考图内容保持可辨识

#### Scenario: Prompt Agent 图片分析正在运行

- **WHEN** Prompt Agent 图片分析预览及其三条分析轨道处于运行状态
- **THEN** 预览和三条轨道使用同一类低对比度模糊动态
- **AND** 不显示锐利扫描线或可被理解为精确进度的扫光

### Requirement: 胶片条临时占位使用紧凑模糊动态

胶片条的运行时临时占位 SHALL 保持现有紧凑尺寸和占位布局，并使用受缩略图边界裁切的低对比度模糊动态。该动态 SHALL NOT 使用横向扫光，且 SHALL NOT 改变胶片条的选择、滚动或图片结果呈现行为。

#### Scenario: 胶片条存在临时占位

- **WHEN** 胶片条在图片结果到达前显示临时占位
- **THEN** 占位显示低对比度的模糊动态而不是横向扫光
- **AND** 胶片条的尺寸与相邻项目布局保持不变

### Requirement: 减少动态效果时保留紧凑忙碌状态语义

当 `prefers-reduced-motion: reduce` 生效时，本能力覆盖的通用按钮、套图参考识别、Prompt Agent 图片分析预览及其三条分析轨道，以及胶片条临时占位 SHALL 停止位移、缩放、透明度或旋转动画。其状态文案、状态色、`aria-busy`、禁用状态和静态边界反馈 SHALL 保持可辨识。

#### Scenario: 系统请求减少动态效果

- **WHEN** 用户开启 `prefers-reduced-motion: reduce` 且任一受覆盖的紧凑反馈处于运行状态
- **THEN** 对应的模糊动态不再播放动画
- **AND** 原有的状态语义和静态视觉反馈仍然显示

### Requirement: 图片生成加载壳不属于紧凑反馈范围

`.generation-loading-shell` SHALL 继续由 `generation-loading` 能力约束。本能力 SHALL NOT 修改该加载壳的 DOM、进度、图标或动态模糊背景行为。

#### Scenario: 图片生成任务正在运行

- **WHEN** 图片生成任务显示 `.generation-loading-shell`
- **THEN** 该加载壳维持 `generation-loading` 所定义的行为
- **AND** 紧凑操作反馈的样式调整不会改变它
