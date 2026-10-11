## MODIFIED Requirements

### Requirement: Saved API histories are isolated by channel

The configuration surface SHALL maintain separate saved endpoint histories for route, direct
image, direct text/vision, Gemini, and Grok channels. Saving, selecting, or deleting an entry in
one channel SHALL NOT change the entries or live fields of another channel. An unscoped legacy
history SHALL NOT be copied into every channel during migration.

#### Scenario: Save one channel

- **WHEN** the user saves a complete API in the Grok channel
- **THEN** it appears in the Grok saved list
- **AND** it does not appear in the GPT, Gemini, direct-image, or direct-text saved lists

#### Scenario: Select or delete one channel

- **WHEN** the user selects or deletes a saved API in one channel
- **THEN** only that channel's address, suffix, key, model fields, and history can change

## ADDED Requirements

### Requirement: API 切换恢复最后保存的模型

系统 SHALL 为每个通道内的 API 历史条目保留最后保存的模型。路由通道 SHALL 同时保留 Responses 模型和生图工具模型；直连生图、直连文本/视觉、Gemini、Grok SHALL 分别保留所属通道的模型。条目身份 SHALL 继续由地址与 Key 决定，同一地址搭配不同 Key 的模型记忆 SHALL 相互独立。

选择已保存 API 时，系统 SHALL 同时回填该条目的非空模型字段，并刷新模型列表选中态、生成模型信息与模型相关质量选项。受限模型下拉 SHALL 仅恢复其中存在的选项。选择操作 SHALL NOT 自动保存配置或把未保存模型覆盖到历史条目。

#### Scenario: 两个 API 来回切换

- **WHEN** 用户分别为 API A 和 API B 保存不同模型，随后选择 A、B、再选择 A
- **THEN** 每次选择都回填对应 API 最后保存的模型
- **AND** 其他通道的模型与历史保持不变

#### Scenario: 同一 API 再次保存模型

- **WHEN** 用户修改某个 API 的模型并保存配置
- **THEN** 该 API 的历史条目更新为本次保存的模型
- **AND** 刷新页面后切回该 API 仍恢复本次保存的模型

#### Scenario: 未保存的模型编辑

- **WHEN** 用户修改模型但未保存，然后选择另一个 API 再切回
- **THEN** 原 API 恢复最后保存的模型
- **AND** 未保存编辑不成为该 API 的模型记忆

#### Scenario: 旧记录没有模型

- **WHEN** 用户选择没有模型字段的旧 API 历史条目
- **THEN** 当前模型保留，地址、后缀和 Key 仍按既有规则切换
- **AND** 加载已有私有配置时为当前 API 补上已保存模型
