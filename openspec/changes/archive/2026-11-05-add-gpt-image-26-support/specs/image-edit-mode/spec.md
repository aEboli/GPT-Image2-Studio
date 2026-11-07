## ADDED Requirements

### Requirement: 标注引导与蒙版编辑互斥

系统 SHALL 在现有单源图编辑入口提供独立的标注引导方式，向支持该能力的 Images edits 端点发送 markup。标注 SHALL 是方向归一化后与首图等尺寸并含透明像素的有效 PNG。markup 与 mask MUST NOT 在同一编辑请求中提交，既有蒙版 merge/sequential 策略 SHALL 保持可用。

#### Scenario: 使用标注引导
- **WHEN** 用户在源图上绘制合法标注并提交编辑指令
- **THEN** 上游收到绑定该首图的 markup 数据和正确的模型/复杂度参数
- **AND** 记录显示实际编辑端点和编辑方式

#### Scenario: 标注和蒙版同时提交
- **WHEN** 请求同时包含 markup 和 mask
- **THEN** 后端在上游调用前拒绝请求并说明互斥原因

#### Scenario: 标注方向或透明度错误
- **WHEN** 标注 PNG 与方向归一化后的源图尺寸不一致或没有透明像素
- **THEN** 系统拒绝提交并给出修复提示
- **AND** 不把错误标注作为普通参考图继续发送
