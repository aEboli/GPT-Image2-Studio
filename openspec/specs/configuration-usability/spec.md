# configuration-usability Specification

## Purpose
TBD - created by archiving change compact-config-log-panel. Update Purpose after archive.

## Requirements

### Requirement: 配置区长说明不占用表单流

调用通道字段的长说明 SHALL 以字段旁的可见说明标记提供，说明标记 SHALL 支持鼠标悬停和键盘聚焦；完整说明 SHALL 通过既有 tooltip 显示。说明标记 SHALL 保留可访问名称和 `aria-describedby` 关联，且 SHALL NOT 让长说明在未交互时占据表单垂直空间。

#### Scenario: 用户查看调用通道说明

- **WHEN** 用户将鼠标移到说明标记上，或使用键盘聚焦说明标记
- **THEN** 完整说明显示在悬浮提示中
- **AND** 调用通道卡片的输入控件位置不因提示出现而重新排版

### Requirement: 生成日志在配置抽屉中保持可见且独立滚动

配置抽屉 SHALL 将配置表单与生成日志放在两个内部区域。日志区域 SHALL 具有不小于 180px 且随视口变化的高度上限；日志标题、板块切换和未读指示 SHALL 保持在日志视口内，时间线条目 SHALL 在自身列表中垂直滚动。新增日志条目 SHALL NOT 推动日志区域离开当前抽屉视口。

#### Scenario: 生成任务持续产生日志

- **WHEN** 生成任务在配置抽屉打开时新增或更新日志条目
- **THEN** 日志区域高度保持在响应式边界内
- **AND** 用户可以在时间线列表内滚动查看条目
- **AND** 配置表单滚动位置与日志列表滚动位置彼此独立

#### Scenario: 小视口打开配置抽屉

- **WHEN** 设备为平板或手机布局
- **THEN** 日志区域仍保留最小可用高度并可独立滚动
- **AND** 保存/测试操作仍可通过表单底部操作栏访问

### Requirement: Custom help triggers use one tooltip surface

Every visible control with `data-tooltip` SHALL show help through the shared application tooltip only. The application SHALL remove any native `title` attribute from that trigger before or while displaying the shared tooltip, while preserving the control's accessible name and any pre-existing `aria-describedby` relationship.

#### Scenario: User hovers a configuration help marker

- **WHEN** the user hovers a configuration help marker with `data-tooltip`
- **THEN** exactly one application tooltip surface displays the complete help text
- **AND** no browser-native title tooltip is displayed for the same trigger.

#### Scenario: User focuses a custom help trigger

- **WHEN** a keyboard user focuses a control with `data-tooltip`
- **THEN** the shared application tooltip is associated through `aria-describedby`
- **AND** the trigger remains keyboard-operable with its accessible name intact.

### Requirement: Configuration sections group GPT modes and expose Grok

The configuration drawer SHALL present top-level sections in the order `GPT`, `Gemini`, `Grok`, and `配色`. The GPT section SHALL show a route-mode/direct-mode selector immediately below the top-level selector. Gemini and Grok sections SHALL show only their own provider settings.

#### Scenario: GPT section shows nested mode switch

- **WHEN** the user selects GPT
- **THEN** the route-mode/direct-mode switch is visible directly below the top-level configuration selector
- **AND** selecting either option activates only the corresponding GPT panel

#### Scenario: Gemini and Grok section selection

- **WHEN** the user selects Gemini or Grok
- **THEN** the GPT nested switch is hidden
- **AND** the selected section activates route C or D respectively

#### Scenario: Palette section

- **WHEN** the user selects 配色
- **THEN** no image provider route is changed
- **AND** the palette controls remain available

### Requirement: Resolution labels describe concrete output choices

The configuration drawer SHALL present a concrete resolution label and value for every image route. It SHALL NOT present a placeholder or automatic-resolution choice, and switching aspect ratios or image routes SHALL immediately replace a historical automatic value with the applicable concrete default.

#### Scenario: Changing ratio replaces a legacy value

- **WHEN** the selected aspect ratio changes while the current resolution value is missing, invalid, or historically auto
- **THEN** the control selects the first concrete size for the new ratio
- **AND** the generated form data contains that concrete size

#### Scenario: Switching to Gemini uses a concrete tier

- **WHEN** the user switches from GPT or Grok to Gemini
- **THEN** the resolution control selects 1K when the previous value is not a valid Gemini tier
- **AND** the Gemini request does not contain auto

### Requirement: Configuration density adapts to available width

The configuration drawer SHALL use a compact two-column arrangement for compatible provider fields when the available viewport is at least 600px. Endpoint fields SHALL remain full width, and the drawer SHALL fall back to a single-column arrangement below that threshold. The layout MUST preserve all existing form controls and their saved field names.

#### Scenario: Medium-width provider configuration

- **WHEN** a provider configuration is opened at a viewport at least 600px wide
- **THEN** compatible credentials and model fields share rows
- **AND** endpoint fields remain full width
- **AND** every existing provider control remains available

#### Scenario: Narrow provider configuration

- **WHEN** a provider configuration is opened below 600px wide
- **THEN** its fields remain in one readable column
- **AND** controls retain the existing touch target sizing

### Requirement: Configuration navigation remains reachable

The configuration drawer SHALL keep the top-level provider selector reachable while the form scrolls. When GPT is selected, its nested route/direct selector SHALL remain reachable with the provider selector. The selectors SHALL continue to control the existing route state without changing persisted configuration keys.

#### Scenario: Scroll a long provider form

- **WHEN** the user scrolls a provider configuration form
- **THEN** the provider selector remains available at the top of the form viewport
- **AND** the GPT nested selector remains available when GPT is active

### Requirement: Wide desktop configuration and log are independent columns

At a viewport at least 1120px wide, the configuration drawer SHALL present the form and generation log as independent columns. The log SHALL retain its minimum usable height and its own vertical scrolling. Narrower layouts SHALL retain the existing stacked arrangement.

#### Scenario: Wide desktop drawer

- **WHEN** the configuration drawer opens on a wide desktop viewport
- **THEN** the form and generation log are visible in parallel columns
- **AND** scrolling one column does not move the other column

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
- **THEN** only that channel's address, suffix, key, and history change

### Requirement: Configuration and log surfaces remain compact and balanced

The configuration drawer SHALL use equal visual columns for the form and generation log at wide
desktop widths, and SHALL use a compact single-column flow at narrower widths. Compatible fields
SHALL align in a symmetric grid without removing controls.

#### Scenario: Wide drawer

- **WHEN** the drawer has desktop-wide available space
- **THEN** the form and log occupy balanced columns with independent scrolling
- **AND** the active provider fields remain aligned and centered within their cards

#### Scenario: Narrow drawer

- **WHEN** the drawer is narrow or rendered by a compact client
- **THEN** fields remain usable without horizontal page overflow
- **AND** labels and controls remain single-line with ellipsis or compact sizing

### Requirement: Long configuration and log text does not wrap the layout

Visible labels, buttons, tabs, log summaries, URLs, output paths, and metadata SHALL use a
single-line presentation. Long values SHALL be truncated visually with an ellipsis while their
complete value remains available through an accessible title, link, or hint.

#### Scenario: Long log URL

- **WHEN** a generation log contains a long relay URL or output path
- **THEN** the row stays within the log viewport without wrapping
- **AND** the complete value remains inspectable

### Requirement: 配置抽屉标题和字段保持可读对齐

配置抽屉的接口标题行 SHALL 为标题保留可读的最小宽度，并 SHALL 让协议后缀和辅助操作控件在剩余空间内收缩。API Key、模型和端点字段的标题行 SHALL 使用一致的最小高度与输入控件列线。可用空间不足时 SHALL 使用单行省略，不得通过换行改变抽屉高度或横向溢出。

#### Scenario: 宽屏显示提供方接口

- **WHEN** 用户在宽屏配置抽屉中查看任一提供方
- **THEN** 接口标题保持可读，不被协议后缀下拉框或完整 URL 按钮挤成空标题
- **AND** 凭据与模型字段的标题和输入控件沿对称列线排列

#### Scenario: 窄屏显示长标题

- **WHEN** 配置抽屉宽度不足以展示完整的辅助值
- **THEN** 标题和辅助值保持单行，辅助值在自身区域省略
- **AND** 页面不出现水平滚动或文本换行

### Requirement: 宽屏配置抽屉控制无效空白

当视口宽度至少为 1120px 时，配置抽屉 SHALL 具有上下视觉边界与视口高度上限，表单和生成日志 SHALL 以等宽双栏呈现并各自滚动。低于该宽度时 SHALL 保持现有窄屏抽屉几何与触控尺寸。

#### Scenario: 宽屏打开配置

- **WHEN** 用户在桌面宽屏打开配置抽屉
- **THEN** 抽屉面板上下不贴住视口边缘
- **AND** 表单与日志列等宽、顶部对齐，日志不会把表单推成第二个页面

### Requirement: 配置日志使用紧凑单行节奏

配置抽屉内的日志条目 SHALL 使用紧凑的纵向间距和元信息间距。摘要、URL、路径、错误与元数据 SHALL 继续保持单行省略，完整值 SHALL 仍可通过既有标题或链接检查。

#### Scenario: 日志持续增长

- **WHEN** 配置抽屉中新增多条生成日志
- **THEN** 日志条目之间的空白不会无谓扩大
- **AND** 长值不会换行或撑破日志列

### Requirement: Provider endpoint headings use one compact geometry

The configuration drawer SHALL use the same single-line endpoint heading geometry for GPT, Gemini, and Grok. Each provider SHALL keep a readable title track, a compact protocol suffix area, and a separate base URL input row. A provider with a fixed protocol path SHALL show that path as a non-editable value and SHALL NOT invent an editable endpoint choice.

#### Scenario: Gemini endpoint is shown beside GPT and Grok

- **WHEN** the user selects Gemini in the configuration drawer
- **THEN** the endpoint title, protocol suffix area, and base URL input align with the corresponding GPT and Grok elements
- **AND** the visible suffix is the concrete `images/generations` path

#### Scenario: Gemini full URL remains inspectable

- **WHEN** the Gemini base URL changes or a saved Gemini endpoint is selected
- **THEN** the suffix keeps the fixed protocol path as its visible text
- **AND** the resolved full request URL remains available through the suffix title and accessible label

#### Scenario: Compact client has insufficient width

- **WHEN** the Gemini endpoint heading is narrower than its content
- **THEN** the title and suffix remain on one line and truncate within their own tracks
- **AND** no endpoint text wraps or creates horizontal overflow

### Requirement: Configuration controls reflect the selected image route

The generation parameter panel SHALL show the reasoning-effort control only for image routes that support GPT reasoning. When Grok is selected, the control SHALL be hidden and disabled, and the quality selector SHALL be rebuilt from the Grok-only options. Returning to GPT SHALL restore the GPT reasoning control and its route-specific quality value.

#### Scenario: Grok parameters are targeted

- **WHEN** the user selects Grok in the configuration drawer
- **THEN** the main image reasoning control is hidden and disabled
- **AND** the quality selector shows only `low` and `medium`
- **AND** the tool does not display a GPT-only quality tier as the current Grok value

#### Scenario: Returning to GPT restores controls

- **WHEN** the user switches from Grok back to GPT
- **THEN** the reasoning control becomes visible and enabled
- **AND** the GPT quality value last selected for the active GPT route is restored
