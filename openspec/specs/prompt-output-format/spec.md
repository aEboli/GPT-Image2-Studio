# prompt-output-format Specification

## Purpose
定义 GPT 提示词生图的自动格式解析、手动选择优先、非阻断兼容性处理、任务格式快照和 GIF 动画原件验证。
## Requirements
### Requirement: 提示词输出格式自动解析

GPT 提示词生图 SHALL 默认提供自动格式，SHALL 将明确的 PNG、JPEG/JPG、WebP、GIF、SVG 或动图输出要求解析为具体格式，无明确要求时 SHALL 使用 PNG。自动策略 MUST NOT 作为 auto 格式传给接口。

#### Scenario: 明确要求循环动图
- **WHEN** 用户在自动模式输入“生成一张循环播放的 GIF 动画”
- **THEN** 最终请求使用 output_format=gif 并携带该任务的帧数和时长

#### Scenario: 动画风格及否定不触发动图
- **WHEN** 用户仅描述动画风格、画面内的 GIF 字样，或要求“不要动图，输出 PNG”
- **THEN** 不将这些内容误判为 GIF 动画请求

### Requirement: 手动选择优先且可复核

系统 SHALL 让格式快捷入口和下拉框共用选择，SHALL 通过按钮高亮展示实际输出格式，并在选择 GIF 时提供帧数和每帧时长输入框。手动指定 SHALL 优先于提示词，冲突 SHALL 不阻止请求。输出格式区域 MUST NOT 展示额外说明、状态、冲突或能力提示文案。

#### Scenario: 手动 PNG 覆盖提示词 GIF
- **WHEN** 提示词要求 GIF 而用户手动选择 PNG
- **THEN** 系统高亮 PNG 并继续以 PNG 生成，不在输出格式区域显示冲突提示

#### Scenario: 提示词模式不重复展示格式入口
- **WHEN** 提示词模式的上方格式快捷入口可见
- **THEN** 参数设置中共享格式下拉框的外层字段隐藏，但保留控件及其选择状态
- **AND** 切换到没有上方快捷入口的模式或通道时恢复下方格式下拉框

### Requirement: 模型格式兼容性由接口判断

GPT 提示词生图的自动和手动策略 SHALL 可用于所有现有 GPT Image 模型及直连别名。GIF/SVG 能力未在本地确认时 MUST NOT 因模型名称或本地能力枚举阻止请求、改为 PNG 或发起额外生图请求。输出格式区域 MUST NOT 显示能力提示；既有编辑、参考图及其他参数组合约束 SHALL 保持。

#### Scenario: 旧模型或自定义模型请求 GIF
- **WHEN** 用户向 gpt-image-2、2.5 或自定义直连模型请求 GIF
- **THEN** 本地仍将 GIF 格式及帧参数发送给实际接口，输出格式区域不显示能力提示
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

### Requirement: 紧凑自动格式开关与实际格式反馈

提示词输出格式 SHALL 在标题右侧提供自动开关，并将 PNG、JPG、WebP、GIF 动画和 SVG 矢量按钮按此顺序保持在同一行。自动开启时 SHALL 禁用手动格式按钮，SHALL 始终高亮解析后的实际格式；关闭时 SHALL 将当前实际格式转为手动选择并允许点击格式按钮。格式按钮下方 SHALL 仅在选择 GIF 时显示帧数和每帧时长输入框及其字段标签，MUST NOT 显示其他提示文案或留下空提示段落。既有格式解析、手动优先、GIF 参数、兼容性和任务快照规则 SHALL 保持。

#### Scenario: 自动解析并高亮
- **WHEN** 自动开启且用户输入明确的 GIF 或 SVG 输出要求
- **THEN** 对应格式高亮，所有格式按钮不可手动选择
- **AND** 无明确格式要求时 PNG 高亮，不额外显示自动默认来源文字

#### Scenario: 关闭和重新开启自动
- **WHEN** 用户关闭自动
- **THEN** 当前解析格式成为手动选择，格式按钮恢复可选且高亮当前格式
- **AND** 重新开启自动后按当前提示词重新解析并高亮格式，格式按钮再次禁用

#### Scenario: 窄屏单行格式布局
- **WHEN** 在桌面或 360px 窄屏展示格式控件
- **THEN** 五个具体格式按钮保持一行，包括 SVG，文字可读且不超出控件或视口

