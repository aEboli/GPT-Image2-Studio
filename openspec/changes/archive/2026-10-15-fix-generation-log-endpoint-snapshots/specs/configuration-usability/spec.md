## MODIFIED Requirements

### Requirement: Configuration density adapts to available width

The configuration drawer SHALL use a compact two-column arrangement for compatible provider fields when the available viewport is at least 600px. Endpoint fields SHALL remain full width, including both direct image and direct text/vision endpoints, and the drawer SHALL fall back to a single-column arrangement below that threshold. The layout MUST preserve all existing form controls and their saved field names. 地址输入与协议后缀 SHALL 提供当前完整值的提示，切换已保存 API、显示模式或手动编辑地址后 SHALL 同步提示。

#### Scenario: Medium-width provider configuration

- **WHEN** a provider configuration is opened at a viewport at least 600px wide
- **THEN** compatible credentials and model fields share rows
- **AND** endpoint fields remain full width
- **AND** every existing provider control remains available

#### Scenario: Narrow provider configuration

- **WHEN** a provider configuration is opened below 600px wide
- **THEN** its fields remain in one readable column
- **AND** controls retain the existing touch target sizing

#### Scenario: 直连的两个接口地址

- **WHEN** 用户打开桌面直连配置
- **THEN** 生图地址和文本/视觉地址分别占据整行，协议后缀与完整 URL 按钮有独立空间
- **AND** 长地址可通过输入框与完整值提示检查

### Requirement: Long configuration and log text does not wrap the layout

Visible labels, buttons, tabs, log summaries, URLs, output paths, and metadata SHALL use a single-line presentation. Long values SHALL be truncated visually with an ellipsis while their complete value remains available through an accessible title, link, or hint. 日志接口 URL SHALL 独占一行，行内不换行；超出宽度时 SHALL 可横向滚动并通过键盘聚焦检查完整地址，且 SHALL NOT 撑破日志列。

#### Scenario: Long log URL

- **WHEN** a generation log contains a long relay URL or output path
- **THEN** each value stays within the log viewport without wrapping internally
- **AND** the relay URL occupies its own row and can be focused and scrolled horizontally
- **AND** the complete value remains inspectable
