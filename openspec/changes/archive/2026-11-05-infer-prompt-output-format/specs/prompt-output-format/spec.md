## ADDED Requirements

### Requirement: 提示词输出格式自动解析

GPT 提示词生图 SHALL 默认提供自动格式，SHALL 将明确的 PNG、JPEG/JPG、WebP、GIF、SVG 或动图输出要求解析为具体格式，无明确要求时 SHALL 使用 PNG。自动策略 MUST NOT 作为 auto 格式传给接口。

#### Scenario: 明确要求循环动图
- **WHEN** 用户在自动模式输入“生成一张循环播放的 GIF 动画”
- **THEN** 最终请求使用 output_format=gif 并携带该任务的帧数和时长

#### Scenario: 动画风格及否定不触发动图
- **WHEN** 用户仅描述动画风格、画面内的 GIF 字样，或要求“不要动图，输出 PNG”
- **THEN** 不将这些内容误判为 GIF 动画请求

### Requirement: 手动选择优先且可复核

系统 SHALL 让格式快捷入口和下拉框共用选择，SHALL 在提交前展示实际输出格式、来源及 GIF 帧参数。手动指定 SHALL 优先于提示词，冲突 SHALL 只提示且不阻止请求。

#### Scenario: 手动 PNG 覆盖提示词 GIF
- **WHEN** 提示词要求 GIF 而用户手动选择 PNG
- **THEN** 系统提示冲突并继续以 PNG 生成

### Requirement: 模型格式兼容性只提示

GPT 提示词生图的自动和手动策略 SHALL 可用于所有现有 GPT Image 模型及直连别名。GIF/SVG 能力未在本地确认时 SHALL 只提示，MUST NOT 因模型名称或本地能力枚举阻止请求、改为 PNG 或发起额外生图请求。既有编辑、参考图及其他参数组合约束 SHALL 保持。

#### Scenario: 旧模型或自定义模型请求 GIF
- **WHEN** 用户向 gpt-image-2、2.5 或自定义直连模型请求 GIF
- **THEN** 本地只显示能力提示，仍将 GIF 格式及帧参数发送给实际接口
- **AND** 由接口返回实际成功或失败

### Requirement: 输出格式与帧参数冻结

系统 SHALL 在任务入队时固定具体输出格式及帧参数，排队、重试和历史 SHALL 使用该快照，MUST NOT 因当前控件或提示词变化重新推断。

#### Scenario: 入队后修改格式
- **WHEN** GIF 任务已入队而用户将下一任务改为 PNG 并修改帧参数
- **THEN** 已入队任务仍以原 GIF 格式及帧参数提交

### Requirement: GIF 动画按真实文件验证

系统 SHALL 保留 GIF 原件并核对真实格式和帧数，MUST NOT 将 PNG 或少于两帧的 GIF 当作动画成功。

#### Scenario: 上游返回静态伪动画
- **WHEN** GIF 请求收到 PNG 或单帧 GIF
- **THEN** 系统在收到结果后报告格式或动画校验错误
- **AND** 不以动画成功登记该资产
