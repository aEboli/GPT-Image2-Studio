## ADDED Requirements

### Requirement: 思考等级完整选项与统一默认值
系统 SHALL 在全部思考等级控件提供 none、minimal、low、medium、high、xhigh、max，未指定时默认 high。系统 SHALL 保留明确选择和已保存的有效等级。文本调用 SHALL 使用所属面板的等级，不得在分析、营销、Listing 或文章规划中静默固定为 low 或 medium。

#### Scenario: 套图识别和营销遵循选择
- **WHEN** 用户在套图面板选择 max 并发起智能识别、AI 营销或 Listing
- **THEN** 文本请求传递 max，未指定等级的新请求使用 high

#### Scenario: 不同协议映射思考等级
- **WHEN** 文本模型或外层 Responses 模型收到用户选择的等级
- **THEN** Responses 请求使用 reasoning.effort，Chat Completions 请求使用 reasoning_effort
- **AND** 直接生图接口不伪造文本思考参数

#### Scenario: 命令行默认值和显式选择
- **WHEN** 用户通过命令行生图，未指定思考等级或使用 --reasoning-effort、REASONING_EFFORT 指定等级
- **THEN** 未指定时使用 high，显式等级进入 Responses 外层请求并沿用同一就近适配策略

### Requirement: 上游明确拒绝时就近适配思考等级
系统 SHALL 仅在上游明确返回思考等级或思考参数不支持的客户端错误时，使用上游支持列表中距离请求等级最近的选项；等距时优先较低等级。未提供支持列表时 MAY 在预算内尝试相邻等级。不支持整个参数时 SHALL 仅移除思考参数。兼容请求 SHALL 共享既有逻辑操作重试预算并展示原等级、实际等级和原因，MUST NOT 对取消、权限、限流、网络或不相关错误触发该重试。

#### Scenario: 不支持 max 而支持 high
- **WHEN** 请求 max 且上游明确只支持 low、medium、high
- **THEN** 在剩余重试预算内自动使用 high，并报告 max 到 high 的调整

#### Scenario: none 需要提升到最近支持等级
- **WHEN** 请求 none 且上游支持 minimal、low、high
- **THEN** 自动使用 minimal

#### Scenario: 兼容重试与格式修复共享预算
- **WHEN** 首次请求被思考参数拒绝且第二次请求返回无效 JSON
- **THEN** 系统报告失败，不发出第三次上游 POST
