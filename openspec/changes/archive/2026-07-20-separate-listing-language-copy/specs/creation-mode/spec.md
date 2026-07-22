## MODIFIED Requirements

### Requirement: Creation records display and expose Listing drafts in the old-style format
The Creation record UI SHALL display every current Listing draft using the fixed section order 标题、卖点、痛点、五点描述、商品描述、后台搜索词、关键词分组. Each English value SHALL be followed by its corresponding Simplified Chinese reference. Every visible English value SHALL be an independent copy target that copies only that English value, and every visible Chinese reference SHALL be an independent copy target that copies only that Chinese value. Field-title copy SHALL copy the complete English value for that field, while full-copy and export actions SHALL preserve the complete bilingual field mapping. All copy/export actions SHALL be immediately available without validation or review gating.

#### Scenario: User opens a newly generated Listing draft
- **WHEN** a completed Listing is rendered in a Creation record
- **THEN** all seven old-style sections are shown in the fixed order
- **AND** each English scalar or list entry is followed by its matching `中文参考` value
- **AND** the English value and Chinese reference are rendered as separate copy targets
- **AND** the UI does not show validation, retry-review or `needs-review` controls

#### Scenario: User copies a visible English Listing value
- **WHEN** the user clicks the visible English title, field value, or list information point
- **THEN** the clipboard contains only the clicked English value
- **AND** the clipboard does not contain its Chinese reference

#### Scenario: User copies a visible Chinese Listing reference
- **WHEN** the user clicks a visible `中文参考` value
- **THEN** the clipboard contains only that Chinese value
- **AND** the clipboard does not contain the English value

#### Scenario: User copies or exports a Listing draft
- **WHEN** the user invokes field-title copy, full copy or export
- **THEN** field-title copy contains the selected field's English content only
- **AND** full copy and structured export retain the old-style bilingual field mapping
- **AND** the actions are not blocked by validation, review, warnings or access state
