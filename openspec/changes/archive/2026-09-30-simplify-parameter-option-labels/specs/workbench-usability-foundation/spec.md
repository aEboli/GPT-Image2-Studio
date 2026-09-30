## ADDED Requirements

### Requirement: Parameter selectors use concise values

思考等级选择器 SHALL 只显示等级名称，不显示预计耗时。具体像素分辨率选择器 SHALL 只显示像素宽度与高度，不显示 `xK`、`720P` 或“最大”等档位标签。选择器 SHALL 保留现有 `value`、默认值和请求参数语义；模型协议路由的 provider scale 选项不受本要求影响。

#### Scenario: Reasoning selector has no time estimate

- **WHEN** 用户打开思考等级选择器
- **THEN** 选项显示 `Low`、`Medium`、`High`、`XHigh`
- **AND** 选项文本不包含预计耗时

#### Scenario: Concrete resolution selector has no tier prefix

- **WHEN** 用户打开具体像素分辨率选择器
- **THEN** `1024x1024` 选项显示为 `1024 x 1024`
- **AND** 最大像素值仍然可以选择，但其文本不显示“最大”
- **AND** 选择后提交的 `value` 仍为原有像素字符串
