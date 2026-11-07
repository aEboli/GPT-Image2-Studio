## ADDED Requirements

### Requirement: 直连生图映射按完整模型 ID 单次生效

系统 SHALL 使用 `directImageModelMappings` 保存 `{ source, target }` 规则，旧配置缺少该字段时默认为空数组。两端 SHALL 去除首尾空白并按完整 ID 区分大小写精确匹配。匹配成功时 SHALL 只替换一次；未匹配时 SHALL 原样发送所选模型。系统 SHALL NOT 链式替换或自动猜测模型关系。重复 source 与不完整规则 SHALL 在保存时提示修正，完全空白草稿行不构成规则。

#### Scenario: 已配置别名生效

- **WHEN** 直连生图模型为 `gpt-image-2.6-sunburst` 且存在映射到 `IMAGE-2.6`
- **THEN** 出站生图模型字段为 `IMAGE-2.6`
- **AND** 配置中的原生图模型选择不被覆盖

#### Scenario: 仅执行一次替换

- **WHEN** 规则包括 `A → B` 与 `B → C`，所选生图模型为 `A`
- **THEN** 实际出站模型为 `B`
- **AND** 不继续替换成 `C`

#### Scenario: 未匹配与自映射

- **WHEN** 所选模型没有精确匹配的 source，或匹配规则两端相同
- **THEN** 发送原模型 ID

#### Scenario: 非法规则不能悄悄覆盖

- **WHEN** 用户保存包含重复 source 或仅填写一端的有效行
- **THEN** 系统提示修正并保留草稿
- **AND** 不通过隐式覆盖或猜测目标模型完成保存

### Requirement: 生图映射与其他模型用途隔离

映射 SHALL 仅作用于 GPT 直连生图及编辑的出站模型字段，包括 Images JSON/FormData、Chat Completions 生图以及 Responses 图像生成工具。独立文本/视觉模型、独立 Responses 文本模型和其他调用通道 SHALL NOT 使用该映射。流式开关、参考图导致的 edits 切换 SHALL NOT 绕过映射。

系统 SHALL 保留明确的已知模型能力判断，优先使用原模型的已知能力，原模型未知但映射目标已知时使用该目标的能力。两者均未知时 SHALL 保持既有未知模型约束，不根据相似名称推断能力。可见任务记录 SHALL 能区分所选模型和实际发送的模型名称。

#### Scenario: 已知模型映射为自定义渠道名

- **WHEN** 已知 2.6 模型映射为未知渠道别名
- **THEN** 参数与能力验证仍依据原已知模型
- **AND** 上游生图字段发送渠道别名

#### Scenario: 自定义名称映射为已知模型

- **WHEN** 未知名称 `IMAGE-2.6` 明确映射到 `gpt-image-2.6-sunburst`
- **THEN** 使用映射目标的已知能力进行参数验证
- **AND** 生图请求发送完整的目标 ID

#### Scenario: Responses 生图工具与文本模型分离

- **WHEN** 直连通过 Responses 生图且配置了独立文本模型
- **THEN** 映射作用于实际生图模型字段
- **AND** 独立文本模型仍按其原配置发送

#### Scenario: 文本请求和其他调用通道保持独立

- **WHEN** 存在生图映射但执行文本/视觉请求或其他通道的生图
- **THEN** 相应请求不使用直连生图映射

### Requirement: 映射配置在保存请求与队列之间保持一致

映射 SHALL 在浏览器私有配置、本地配置、JSON/FormData 请求和现有任务配置快照之间往返。局部保存省略映射字段 SHALL 保留已有规则；显式空数组 SHALL 清空规则。映射不得引入跨通道凭据复制或在公开记录中暴露私钥。

#### Scenario: 保存后重新载入

- **WHEN** 用户保存非空映射并重新载入配置
- **THEN** 原规则和生图模型选择均恢复
- **AND** 后续生图请求携带一致的规则

#### Scenario: 显式清空与局部保存

- **WHEN** 用户删除全部规则并保存空数组
- **THEN** 后续请求恢复原模型发送行为
- **WHEN** 之后局部保存省略映射字段
- **THEN** 保留当前已保存的规则状态

#### Scenario: 排队任务冻结映射

- **WHEN** 生图任务入队后用户修改映射配置
- **THEN** 已入队任务继续使用入队时的规则快照
- **AND** 新任务使用更新后的规则
