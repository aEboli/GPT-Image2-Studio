## MODIFIED Requirements

### Requirement: Creation records display and expose Listing drafts in the old-style format
The Creation record UI SHALL preserve every current Listing draft in the fixed field order 标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组 while presenting those fields through `商品文案` and `搜索优化` views. The UI SHALL provide `英文`, `中文`, and `对照` language views, SHALL default to the English publishable copy, and SHALL keep the selected language and content view during normal in-session rerenders. Every visible English value SHALL remain an independent copy target that copies only that English value, and every visible Simplified Chinese value SHALL remain an independent copy target that copies only that Chinese value. Field-level English and Chinese copy controls SHALL copy the complete corresponding language value for that field, while full-copy and export actions SHALL preserve the complete bilingual field mapping. Generate, full-copy, and export controls SHALL remain available from a compact Listing workspace toolbar while the user reviews a long draft. All copy and export actions SHALL be immediately available without validation or review gating.

#### Scenario: User opens a newly generated Listing draft
- **WHEN** a completed Listing is rendered in a Creation record
- **THEN** the UI defaults to the `商品文案` and `英文` views
- **AND** 标题、卖点、痛点、五点描述 and 商品描述 are available in their fixed order under `商品文案`
- **AND** 后台搜索词 and 关键词分组 are available in their fixed order under `搜索优化`
- **AND** the UI does not duplicate the complete English title above the title field
- **AND** the UI does not show validation, retry-review or `needs-review` controls

#### Scenario: User switches the Listing language view
- **WHEN** the user selects `英文`, `中文`, or `对照`
- **THEN** the draft shows only English values, only corresponding Simplified Chinese values, or both corresponding values respectively
- **AND** the selected language view remains active when the Listing view rerenders during the same application session
- **AND** `对照` uses aligned columns when space permits and a vertical arrangement on narrow layouts

#### Scenario: User switches the Listing content view
- **WHEN** the user selects `商品文案` or `搜索优化`
- **THEN** only the fields assigned to that content group are visible
- **AND** switching groups does not alter, omit, reorder, or regenerate the stored seven-field Listing data
- **AND** the selected content view remains active when the Listing view rerenders during the same application session

#### Scenario: User copies a visible English Listing value
- **WHEN** the user clicks a visible English title, field value, list information point, or English field-level copy control
- **THEN** the clipboard contains only the selected English value or complete English field
- **AND** the clipboard does not contain its Chinese counterpart

#### Scenario: User copies a visible Chinese Listing reference
- **WHEN** the user clicks a visible Simplified Chinese value or Chinese field-level copy control
- **THEN** the clipboard contains only the selected Chinese value or complete Chinese field
- **AND** the clipboard does not contain the English value

#### Scenario: User reviews a long Listing draft
- **WHEN** the Listing workspace reaches the top of the scrollable Creation record result area
- **THEN** the Listing heading, generation action, complete-copy action, and export action remain visible while the draft content scrolls
- **AND** character counts are presented as secondary metadata rather than primary status badges

#### Scenario: User reaches Listing controls on a narrow mobile screen
- **WHEN** the user scrolls a mobile Creation record to its Listing workspace
- **THEN** the record header and filter controls remain in normal document flow instead of covering the Listing workspace
- **AND** the content and language controls remain visible and directly operable

#### Scenario: User copies or exports a Listing draft
- **WHEN** the user invokes generation, full copy, or export from the Listing workspace
- **THEN** generation reuses the existing selected-record Listing controller and concurrent-generation guard
- **AND** full copy and structured export retain the old-style bilingual field mapping for all seven fields regardless of the active view
- **AND** the actions are not blocked by validation, review, warnings or access state
