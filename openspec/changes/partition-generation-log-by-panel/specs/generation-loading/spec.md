## ADDED Requirements

### Requirement: Realtime log line under the progress percentage

加载组件 SHALL 支持在百分比下方显示该任务的最新实时状态文本。该行 SHALL 由调用点显式开启，SHALL 只在有状态文本时占位，SHALL 完整显示文本：超长时 SHALL 换行而 SHALL NOT 截断或省略。该行 SHALL NOT 改变百分比时序、`99%` 上限、等待态语义或阶段配色。主预览与套图、写真、文章插图、PPT 的生成卡片 SHALL 显示该行；胶片条、缩略图等小尺寸生成占位 SHALL NOT 显示该行。

#### Scenario: Main preview shows the latest status

- **WHEN** 提示词生图任务的状态更新为“上游重试：正在重试 1/2”
- **THEN** 主预览加载组件在百分比下方显示该状态文本
- **AND** 百分比与阶段颜色不受影响

#### Scenario: Creation card shows the latest status

- **WHEN** 套图某张图正在生成且有状态文本
- **THEN** 该卡片的加载组件在百分比下方显示这行文本

#### Scenario: Small placeholders omit the log line

- **WHEN** 胶片条或缩略图占位处于生成态
- **THEN** 这些加载组件不显示实时日志行
- **AND** 百分比与标签的显示与现状一致

#### Scenario: Empty status text takes no space

- **WHEN** 任务当前没有可显示的状态文本
- **THEN** 实时日志行不占据布局空间

#### Scenario: Long status text wraps and stays readable in full

- **WHEN** 状态文本长度超出加载组件宽度
- **THEN** 文本换行显示完整内容
- **AND** 不出现省略号或被裁掉的尾部

#### Scenario: Waiting mode keeps waiting semantics

- **WHEN** 任务处于排队等待态
- **THEN** 不显示百分比
- **AND** 实时日志行只在有等待状态文本时显示该文本
