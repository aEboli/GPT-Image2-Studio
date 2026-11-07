## ADDED Requirements

### Requirement: SKU 功能效果白底渲染规则

系统 SHALL 在 SKU 生成规则中提供 white-effect-render /“SKU 渲染效果白底图”，且 SHALL 保留原有默认值和其他规则。该规则 SHALL 使用纯白 RGB 255/255/255 背景，以完整、匹配的可售商品主体表现有依据的功能效果，保持外观、原有印字和数量。局部效果及自然接触阴影 SHALL 保持白底纯净，MUST NOT 改为场景、渐变或被效果染色的背景。该规则 MUST NOT 添加色名标签、清单、尺寸标注、营销文字或非包含道具。

#### Scenario: 用户选择功能效果白底 SKU

- **WHEN** 用户选择“SKU 渲染效果白底图”并规划包含 SKU 的套图
- **THEN** 计划保留 white-effect-render 和中文标签
- **AND** SKU 提示词要求纯净白底、完整匹配主体及局部有依据的功能效果
- **AND** 视觉风格不会将白底替换为场景背景
- **AND** 普通营销轮播及其他 SKU 规则保持现有行为

#### Scenario: 商品缺少功能效果依据

- **WHEN** 用户选择该规则但未提供可靠功能依据
- **THEN** 提示词仅允许材质、体积与合理光照表现
- **AND** 提示词禁止虚构功能、内部结构、性能数值、认证或实测结果

#### Scenario: 新规则经过保存与恢复

- **WHEN** 使用新规则的套图经过预览、冻结提交、队列、记录恢复或补图
- **THEN** 现有 skuGenerationRule 字段保留 white-effect-render
- **AND** 对应 SKU 的白底功能渲染要求不会降级为默认色名规则
