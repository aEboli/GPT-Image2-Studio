## ADDED Requirements

### Requirement: 提示词生图可按任务选择输出背景

系统 SHALL 在提示词生图参数区提供透明背景控制，默认关闭。该控制 SHALL 只在提示词生图中可见，且 SHALL NOT 出现在风格迁移、图片编辑、套图、写真、文章插图或 PPT 生成中。浏览器 SHALL 将每个提示词任务选择快照为独立的 `imageBackground` 字段；该字段 MUST NOT 复用后台队列的 `background` 或 `backgroundGeneration` 字段。

服务端 SHALL 只接受 `transparent` 作为透明值，并将缺失、非法或不属于提示词任务的值归一化为 `opaque`。支持图像背景参数的上游请求 SHALL 使用归一化结果；提示词结果的任务和保存元数据 SHALL 记录实际使用的值。

#### Scenario: 用户使用默认不透明背景生成提示词图像

- **WHEN** 用户不启用透明背景并提交提示词生图
- **THEN** 浏览器任务快照和服务端上游请求使用 `imageBackground` / `background` 的 `opaque` 语义
- **AND** 现有后台队列控制仍使用其独立的 `background=1` 信号
- **AND** 输出格式继续使用用户原先选择的格式

#### Scenario: 用户启用透明背景

- **WHEN** 用户在提示词生图参数区开启透明背景
- **THEN** 当前任务快照携带 `imageBackground=transparent`
- **AND** 输出格式被固定为 PNG
- **AND** 支持该参数的上游图像请求携带 `background=transparent`
- **AND** 保存的提示词结果记录实际使用的 `transparent` 值

#### Scenario: 非提示词模式或非法输入请求透明背景

- **WHEN** 风格迁移、图片编辑、套图、写真、文章插图或 PPT 请求携带 `imageBackground=transparent`，或提示词请求携带非白名单背景值
- **THEN** 服务端将该请求的有效背景收敛为 `opaque`
- **AND** 其他模式的既有请求参数和输出行为保持不变

#### Scenario: 模型协议通道不支持该控制

- **WHEN** 用户选择模型协议图像通道
- **THEN** 提示词参数区不展示透明背景控制
- **AND** 该通道不会因为该控制添加不受支持的背景参数
